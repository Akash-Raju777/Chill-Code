const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 1. Load .env
const envPath = path.join(__dirname, '.env');
const env = { ...process.env };
if (fs.existsSync(envPath)) {
  console.log('Loading environment variables from .env...');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      env[key] = value;
    }
  });
}

// 2. Start Backend
console.log('Starting Spring Boot Backend...');
const backendProcess = spawn('cmd.exe', ['/c', 'mvnw.cmd', 'spring-boot:run'], {
  cwd: path.join(__dirname, 'backend'),
  env,
  stdio: 'inherit'
});

backendProcess.on('close', (code) => {
  console.log(`Backend process exited with code ${code}`);
});

// 3. Start Frontend
console.log('Starting Next.js Frontend...');
const frontendProcess = spawn('cmd.exe', ['/c', 'npm', 'run', 'dev'], {
  cwd: path.join(__dirname, 'frontend'),
  env,
  stdio: 'inherit'
});

frontendProcess.on('close', (code) => {
  console.log(`Frontend process exited with code ${code}`);
});

// Handle termination
process.on('SIGINT', () => {
  backendProcess.kill();
  frontendProcess.kill();
  process.exit();
});
