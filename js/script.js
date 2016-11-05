var video = document.getElementById('video');
var cover = $('.cover');
var intervalRewind;

// updateSound() begins when video is loaded, not whether or not cover is closed
function updateSound() {
    maxCheck();
    var soundLevel = AudioHandler.getLevel();
    if (soundLevel > 0.1) {
        inflate(soundLevel);
    } else {
        deflate();
    }
    requestAnimationFrame(updateSound);
}
updateSound();

function inflate(level) {
    if (video.currentTime + level < 43) {
        video.playbackRate += level;
    }
}

function deflate() {
    video.playbackRate = 1.0;
    if (video.currentTime == 0) {
        clearInterval(intervalRewind);
        video.play();
     }
     else {
        video.currentTime += -.1;
     }
}

function maxCheck() {
    if (video.currentTime > 44) {
        video.currentTime = 44;
    }
}

// Close the instructions when clicking anywhere
cover.on('click', function() {
    cover.addClass('cover-closed');
});
