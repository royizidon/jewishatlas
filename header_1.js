// Shared header navigation functionality
document.addEventListener('DOMContentLoaded', function() {
    // ========= FIX FOR FIXED HEADER OVERLAP =========
    // Dynamically adjust body padding to account for fixed header height
    function adjustForFixedHeader() {
        const header = document.getElementById('appHeader');
        if (header) {
            const headerHeight = header.offsetHeight;
            document.body.style.paddingTop = headerHeight + 'px';
        }
    }

    // Set initial padding
    adjustForFixedHeader();

    // Adjust on window resize
    window.addEventListener('resize', adjustForFixedHeader);
    
    // Also adjust after fonts load (custom fonts can change header height)
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(adjustForFixedHeader);
    }

    // ========= NAVIGATION BUTTON HANDLERS =========
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