// Handles HTML and wiring data
// Using Three v60
// Originally written by Felix Turner @felixturner
// Modified by Matthew Chiang

var events = new Events();

var Main = function() {

	function init() {
		document.onselectstart = function() {
			return false;
		};

		AudioHandler.init();
		ControlsHandler.init();

		update();
	}

	function update() {
		requestAnimationFrame(update);
		events.emit("update"); // Confused here about how minivents works
	}

	return {
		init:init
	};
}();

$(document).ready(function() {
	Main.init();
});