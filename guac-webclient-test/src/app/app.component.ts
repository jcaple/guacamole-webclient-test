import { Component } from '@angular/core';
import Guacamole from 'guacamole-common-js';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'guac-webclient-test';

  public constructor() {

  }

  public ngOnInit() {
    this.render();
  }

  public render() {
    let display = document.getElementById('rdp_display');

    // Instantiate client, using an HTTP tunnel for communications.
    
    var guac = new Guacamole.Client(
      new Guacamole.HTTPTunnel("http://localhost:9999/ccgs/tunnel", false, {})
    );

    // Add client to display div
    display.appendChild(guac.getDisplay().getElement());
    
    // Error handler
    guac.onerror = function(error) {
        alert("Error: " + JSON.stringify(error));
    };

    // Connect
    guac.connect();

    // Disconnect on close
    window.onunload = function() {
        guac.disconnect();
    }

    // Mouse
    var mouse = new Guacamole.Mouse(guac.getDisplay().getElement());
    mouse.onmousedown = 
    mouse.onmouseup   =
    mouse.onmousemove = function(mouseState) {
        guac.sendMouseState(mouseState);
    };

    // Keyboard
    var keyboard = new Guacamole.Keyboard(document);
    keyboard.onkeydown = function (keysym) {
        guac.sendKeyEvent(1, keysym);
    };

    keyboard.onkeyup = function (keysym) {
        guac.sendKeyEvent(0, keysym);
    };
  }
}
