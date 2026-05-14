async function generateSampleLogs() {
  const levels = ['debug', 'info', 'warn', 'error'];
  const messages = [
    'User logged in successfully',
    'Failed to connect to database',
    'API request processed',
    'Memory usage high',
    'Cache miss for key',
    'Scheduled task executed',
    'Authentication failed',
    'New user registered',
    'Email sent successfully',
    'Payment processing failed'
  ];

  console.log('Generating sample logs...\n');

  for (let i = 0; i < 20; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    const log = {
      level,
      message: `${message} (sample #${i + 1})`,
      metadata: {
        userId: Math.floor(Math.random() * 1000),
        requestId: `req_${Date.now()}_${i}`,
        duration: Math.floor(Math.random() * 500),
        source: i % 2 === 0 ? 'api' : 'worker'
      }
    };

    try {
      const response = await fetch('http://localhost:3000/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(log)
      });
      
      const result = await response.json();
      console.log(`[${level.toUpperCase()}] ${message} - ID: ${result.id}`);
    } catch (error) {
      console.error('Failed to send log:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\nSample logs generated successfully!');
}

generateSampleLogs();
