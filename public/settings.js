// API helper
function api(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(path, {
        ...options,
        headers,
    }).then(res => {
        if (!res.ok) {
            if (res.status === 401) {
                window.location.href = '/login.html';
                throw new Error('Unauthorized');
            }
            throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
    });
}

// Initialize
async function init() {
    try {
        const user = await api('/me');
        document.getElementById('setting-username').textContent = user.username;
        document.getElementById('creabux-balance').textContent = formatNumber(user.creabux || 0);
    } catch (err) {
        console.error('Init error:', err);
        window.location.href = '/login.html';
    }
}

// Switch tabs
function switchTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Remove active class from nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    // Show selected tab
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Add active class to clicked nav item
    event.target.classList.add('active');
}

// Password change
function showPasswordChange() {
    document.getElementById('password-form').style.display = 'block';
}

function hidePasswordChange() {
    document.getElementById('password-form').style.display = 'none';
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
}

async function changePassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Please fill in all password fields');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    try {
        const res = await api('/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        });

        if (res.ok) {
            alert('Password changed successfully!');
            hidePasswordChange();
        } else {
            alert('Error: ' + (res.error || 'Could not change password'));
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error changing password');
    }
}

// Profile settings
async function saveDisplayName() {
    const displayName = document.getElementById('display-name').value;
    if (!displayName.trim()) {
        alert('Display name cannot be empty');
        return;
    }

    try {
        const res = await api('/profile/display-name', {
            method: 'POST',
            body: JSON.stringify({ displayName }),
        });

        if (res.ok) {
            alert('Display name saved!');
        } else {
            alert('Error: ' + (res.error || 'Could not save'));
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error saving display name');
    }
}

async function saveBio() {
    const bio = document.getElementById('bio').value;

    try {
        const res = await api('/profile/bio', {
            method: 'POST',
            body: JSON.stringify({ bio }),
        });

        if (res.ok) {
            alert('Bio saved!');
        } else {
            alert('Error: ' + (res.error || 'Could not save'));
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error saving bio');
    }
}

async function saveProfileVisibility() {
    const visibility = document.getElementById('profile-visibility').value;

    try {
        const res = await api('/profile/visibility', {
            method: 'POST',
            body: JSON.stringify({ visibility }),
        });

        if (res.ok) {
            alert('Profile visibility updated!');
        } else {
            alert('Error: ' + (res.error || 'Could not save'));
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error updating visibility');
    }
}

// Creabux
async function buyCreabux(amount, price) {
    const confirm_purchase = confirm(`Are you sure you want to purchase ${amount} Creabux for €${price}?`);
    if (!confirm_purchase) return;

    try {
        const res = await api('/creabux/purchase', {
            method: 'POST',
            body: JSON.stringify({ amount }),
        });

        if (res.ok) {
            alert(`Successfully purchased ${amount} Creabux!`);
            // Reload creabux balance
            const user = await api('/me');
            document.getElementById('creabux-balance').textContent = formatNumber(user.creabux || 0);
        } else {
            alert('Error: ' + (res.error || 'Could not complete purchase'));
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error purchasing Creabux');
    }
}

function addPaymentMethod(type) {
    alert(`Add ${type} payment method (not yet implemented)`);
}

// Security
function enable2FA() {
    alert('Two-Factor Authentication (not yet implemented)');
}

function logoutAllDevices() {
    const confirm_logout = confirm('Are you sure you want to logout from all other devices?');
    if (!confirm_logout) return;

    alert('Logged out from all other devices (simulated)');
}

// Format numbers
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Logout
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
