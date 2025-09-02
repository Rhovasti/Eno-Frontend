// Test register endpoint
import fetch from 'node-fetch';

async function testRegisterAPI() {
  console.log('Testing register API...');
  
  try {
    // Register a new user
    console.log('Registering new user...');
    const registerRes = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      })
    });
    
    const registerData = await registerRes.json();
    console.log('Register response:', JSON.stringify(registerData, null, 2));
    
    // Try to login with the new user
    console.log('\nTrying to login with new user...');
    const loginRes = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'newuser@example.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginRes.json();
    console.log('Login response:', JSON.stringify(loginData, null, 2));
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testRegisterAPI();