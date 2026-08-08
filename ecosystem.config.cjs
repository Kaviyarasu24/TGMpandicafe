module.exports = {
  apps: [
    {
      name: 'tgm-backend',
      script: 'index.js',
      cwd: './backend',
      env: {
        NODE_ENV: 'production',
      }
    },
    {
      name: 'tgm-ai-service',
      // Note: On Windows, change this to 'venv/Scripts/uvicorn'
      script: 'venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 5001',
      cwd: './ai-service',
      interpreter: 'none',
      env: {
        PYTHONPATH: '.'
      }
    }
  ]
};
