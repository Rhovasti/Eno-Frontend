// Use native fetch
import fetch from 'node-fetch';

async function testUsersAPI() {
  console.log('Testing users API...');
  
  try {
    // Try to create a JWT token by logging in
    console.log('Logging in as admin...');
    const loginRes = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginRes.json();
    console.log('Login response:', JSON.stringify(loginData, null, 2));
    
    if (!loginData.token) {
      console.error('Failed to get token');
      return;
    }
    
    // Use the token to fetch users
    console.log('\nFetching users with token...');
    const usersRes = await fetch('http://localhost:3000/api/users', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });
    
    const usersData = await usersRes.json();
    console.log('Users API response:', JSON.stringify(usersData, null, 2));
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testUsersAPI();