import os
import pymysql
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
try:
    from prophet import Prophet
except ImportError:
    Prophet = None
import uvicorn
from datetime import datetime, timedelta

# Helper to read environment variables from backend/.env
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    # Strip quotes if present
                    val = val.strip().strip("'").strip('"')
                    os.environ[key.strip()] = val

load_env()

app = FastAPI(title="TGM Pandi Cafe AI Analytics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    connection_url = os.getenv("DATABASE_URL")
    if not connection_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL not found in environment settings.")
    try:
        from urllib.parse import urlparse
        url = urlparse(connection_url)
        conn = pymysql.connect(
            host=url.hostname or 'localhost',
            user=url.username or 'root',
            password=url.password or '',
            database=url.path.lstrip('/') if url.path else '',
            port=url.port or 3306,
            autocommit=True
        )
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

@app.get("/api/ai/analytics-summary")
def get_analytics_summary():
    conn = get_db_connection()
    try:
        df = pd.read_sql_query("SELECT date_time as created_at, total as total_amount FROM bills", conn)
    except Exception as e:
        conn.close()
        return {"error": f"Failed to query bills: {str(e)}"}
        
    if df.empty:
        conn.close()
        return {"error": "Not enough historical sales data available for accurate AI prediction. Continue using the POS system until more sales data is collected."}
    
    df['created_at'] = pd.to_datetime(df['created_at'])
    df['date'] = df['created_at'].dt.date
    
    total_revenue = float(df['total_amount'].sum())
    total_orders = int(len(df))
    unique_days = int(df['date'].nunique())
    avg_daily_revenue = float(total_revenue / unique_days if unique_days > 0 else 0)
    avg_orders_per_day = float(total_orders / unique_days if unique_days > 0 else 0)
    
    daily_revenue = df.groupby('date')['total_amount'].sum().reset_index()
    highest_revenue_day = daily_revenue.loc[daily_revenue['total_amount'].idxmax()] if not daily_revenue.empty else None
    lowest_revenue_day = daily_revenue.loc[daily_revenue['total_amount'].idxmin()] if not daily_revenue.empty else None

    # Fetch product details for best/least selling
    try:
        items_df = pd.read_sql_query("SELECT item_name, quantity, price FROM bill_items", conn)
    except Exception as e:
        conn.close()
        return {"error": f"Failed to query bill items: {str(e)}"}
        
    conn.close()
    
    if not items_df.empty:
        product_sales = items_df.groupby('item_name')['quantity'].sum().reset_index()
        best_selling = product_sales.loc[product_sales['quantity'].idxmax()]
        least_selling = product_sales.loc[product_sales['quantity'].idxmin()]
    else:
        best_selling = {"item_name": "N/A"}
        least_selling = {"item_name": "N/A"}

    return {
        "total_revenue": total_revenue,
        "avg_daily_revenue": avg_daily_revenue,
        "total_orders": total_orders,
        "avg_orders_per_day": avg_orders_per_day,
        "highest_revenue_day": highest_revenue_day['date'].isoformat() if highest_revenue_day is not None else None,
        "highest_revenue_amount": float(highest_revenue_day['total_amount']) if highest_revenue_day is not None else 0,
        "lowest_revenue_day": lowest_revenue_day['date'].isoformat() if lowest_revenue_day is not None else None,
        "best_selling_product": str(best_selling['item_name']),
        "least_selling_product": str(least_selling['item_name']),
    }

@app.get("/api/ai/forecast-revenue")
def get_revenue_forecast():
    if not Prophet:
        return {"error": "Prophet is not installed or failed to load. AI forecasting is disabled."}
        
    conn = get_db_connection()
    try:
        df = pd.read_sql_query("SELECT date_time as created_at, total as total_amount FROM bills", conn)
    except Exception as e:
        conn.close()
        return {"error": f"Failed to query bills: {str(e)}"}
    conn.close()
    
    if len(df) < 2:
        return {"error": "Not enough historical sales data available for accurate AI prediction. Continue using the POS system until more sales data is collected."}
    
    df['created_at'] = pd.to_datetime(df['created_at'])
    df['ds'] = df['created_at'].dt.date
    daily_df = df.groupby('ds')['total_amount'].sum().reset_index()
    daily_df.rename(columns={'total_amount': 'y'}, inplace=True)
    
    try:
        m = Prophet(daily_seasonality=False)
        m.fit(daily_df)
        future = m.make_future_dataframe(periods=30)
        forecast = m.predict(future)
        
        forecast_data = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(30).to_dict(orient='records')
        
        # Tomorrow
        tomorrow = forecast_data[0]
        # Next 7 days
        next_7_days = sum([row['yhat'] for row in forecast_data[:7]])
        # Next 30 days
        next_30_days = sum([row['yhat'] for row in forecast_data[:30]])
        
        # Format date ds to ISO strings
        for row in forecast_data:
            if hasattr(row['ds'], 'isoformat'):
                row['ds'] = row['ds'].isoformat()
            else:
                row['ds'] = str(row['ds'])
        
        return {
            "tomorrow_revenue": tomorrow['yhat'],
            "tomorrow_confidence_lower": tomorrow['yhat_lower'],
            "tomorrow_confidence_upper": tomorrow['yhat_upper'],
            "next_7_days_revenue": next_7_days,
            "next_30_days_revenue": next_30_days,
            "forecast_data": forecast_data
        }
    except Exception as e:
        return {"error": f"Failed to run forecasting model: {str(e)}"}

@app.get("/api/ai/insights")
def get_insights():
    conn = get_db_connection()
    try:
        df = pd.read_sql_query("SELECT date_time as created_at, total as total_amount FROM bills", conn)
    except Exception as e:
        conn.close()
        return {"insights": [f"Failed to query bills: {str(e)}"]}
    conn.close()
    
    if len(df) < 1:
        return {"insights": ["Not enough data to generate insights."]}
        
    df['created_at'] = pd.to_datetime(df['created_at'])
    df['day_of_week'] = df['created_at'].dt.day_name()
    df['hour'] = df['created_at'].dt.hour
    
    insights = []
    
    # Busiest day
    busiest_day = df['day_of_week'].value_counts().idxmax()
    insights.append(f"Historically, {busiest_day} is your busiest day of the week.")
    
    # Peak hour
    peak_hour = df['hour'].value_counts().idxmax()
    insights.append(f"Your peak business time is usually around {peak_hour}:00.")
    
    insights.append("Consider preparing additional stock before peak hours to prevent delays.")
    
    return {"insights": insights}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5001)
