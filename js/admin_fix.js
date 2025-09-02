// Fixed admin functions with proper token handling

function updateUserRoles(userId, newRoles, isAdmin) {
    const token = getCookie('token');
    if (!token) {
        alert('Please login again - session expired');
        window.location.href = '/hml/login.html';
        return;
    }

    fetch(`/api/users/${userId}/roles`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            roles: newRoles,
            is_admin: isAdmin
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        alert('Roles updated successfully');
        location.reload();
    })
    .catch(error => {
        console.error('Error updating roles:', error);
        alert('Error updating roles: ' + error.message);
    });
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}
