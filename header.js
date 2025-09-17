// Shared header navigation functionality
document.addEventListener('DOMContentLoaded', function() {
    // Navigation button handlers
    const uploadBtn = document.getElementById('uploadBtn');
    const wallBtn = document.getElementById('wallBtn');
    const aboutBtn = document.getElementById('aboutBtn');
    const backBtn = document.getElementById('backBtn');
    const mapBtn = document.getElementById('mapBtn');

    // Upload button
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            window.location.href = 'upload.html';
        });
    }

    // Wall button
    if (wallBtn) {
        wallBtn.addEventListener('click', () => {
            window.location.href = 'wall.html';
        });
    }

    // About button
    if (aboutBtn) {
        aboutBtn.addEventListener('click', () => {
            window.location.href = 'about.html';
        });
    }

    // Back to Map button (for non-index pages)
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // Map button (alternative name for back to map)
    if (mapBtn) {
        mapBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
});