var video = document.getElementById('video');
var intervalRewind;
console.log(video);
console.log(AudioHandler.getLevel());

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
requestAnimationFrame(updateSound);

function inflate(level) {
    // console.log(level);
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