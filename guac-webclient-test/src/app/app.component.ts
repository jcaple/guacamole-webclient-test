import { Component } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { GuacDialogComponent } from './dialogs/guac-dialog/guac-dialog.component';
import * as Caple from '../assets/BlobWriter.js';
import Guacamole from 'guacamole-common-js';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'guac-webclient-test';

  private guac: Guacamole.Client = null;
  private dlgRef: MatDialogRef<GuacDialogComponent> = null;
  public static _self;

  private mouse;
  private keyboard;

  public constructor(private dialog: MatDialog) {
    AppComponent._self = this;
  }

  public ngOnInit() {
    this.render();
  }

  public render() {

    // Instantiate client, using an HTTP tunnel for communications.
    
    this.guac = new Guacamole.Client(
      new Guacamole.HTTPTunnel("http://localhost:9999/ccgs/tunnel", false, {})
    );

    
    // Error handler
    this.guac.onerror = function(error) {
        alert("Error: " + JSON.stringify(error));
    };

    // Connect
    this.guac.connect();

    this.guac.onstatechange = state => {
      console.log('GUAC state', JSON.stringify(state));
      console.log("CONNECTED STATE: " + this.guac.currentState);
      console.log("Http Tunnell State: " + JSON.stringify(Guacamole.Tunnel.State));

      if (state[0] !== Guacamole.Tunnel.State.UNSTABLE || state !== Guacamole.Tunnel.State.CLOSED) {
        //this.registerKeyboardAndMouse();
      }

      if (state[0] == this.guac.STATE_CONNECTED) {

        setTimeout(() => {
          const display = document.getElementById('rdp_display'); //display of the desktop

          console.log("GUAC Display Width => " + this.guac.getDisplay().getWidth());
          console.log("GUAC Display Height => " + this.guac.getDisplay().getHeight());

          // Add client to display div
          display.appendChild(this.guac.getDisplay().getElement());
      
          // This is to make the canvas put z-index high for it to display
          display.getElementsByTagName('canvas')[0].setAttribute('style', 'z-index: 999999;');
  
  
          // Add drag-and-drop events to the display
          display.addEventListener("dragover", this.handleDragOverEvent, false);
          display.addEventListener("drop", this.handleDropEvent, false);

          this.registerKeyboardAndMouse();

        }, 1000);
        
      }
    };

    // File transfers
    this.guac.onfile = (fs, mimetype, filename) => {
      console.log("Received a file transfer event => " + filename + ", " + mimetype + ", " + JSON.stringify(fs));
      let input_stream: Guacamole.InputStream = fs;

      console.log("InputStream Index: " + input_stream.index);

      let blobReader: Guacamole.BlobReader = new Guacamole.BlobReader(input_stream, mimetype);

      // Tell guacamole server we are ready to receive download
      input_stream.sendAck("OK", 0x000);

      this.showFileTransferDialog();

      // Disconnect on close
      window.onunload = () => {
        this.guac.disconnect();
        this.mouse = null;
        this.keyboard.onkeydown = null;
        this.keyboard.onkeyup = null;
        this.keyboard = null;
        console.log('disconnecting!!');
      };

      blobReader.onprogress = async (length) => {
        console.log("BlobReader read this many bytes so far: " + blobReader.getLength());
        this.dlgRef.componentInstance.bytes_transferred = blobReader.getLength();
      };

      blobReader.onend = () => {
        console.log("BlobReader onend invoked: " + mimetype);
        
        let blob = blobReader.getBlob();

        console.log("Blob Length => " + blobReader.getLength());
        this.dlgRef.componentInstance.bytes_transferred = blobReader.getLength();

        return this.downloadFile(blob, mimetype, filename).then(() => {
          setTimeout(() => {
            this.closeFileTransferDialog();
          }, 2000);
          
        });
      }

    };

    this.guac.onack = (status: Guacamole.Status) => {
      console.log("OnAck Status => " + status.code + ":" + status.message);
    };  
  }

  registerKeyboardAndMouse() {
    // Mouse
    this.mouse = new Guacamole.Mouse(this.guac.getDisplay().getElement());

    this.mouse.onmousedown =
      this.mouse.onmouseup =
      this.mouse.onmousemove = (mouseState) => {
        this.guac.sendMouseState(mouseState);
      };

    // Keyboard
    this.keyboard = new Guacamole.Keyboard(document);

    this.keyboard.onkeydown = (keysym) => {
      this.guac.sendKeyEvent(1, keysym);
    };

    this.keyboard.onkeyup = (keysym) => {
      this.guac.sendKeyEvent(0, keysym);
    };
  }

  showFileTransferDialog() {
    this.dlgRef = this.dialog.open(GuacDialogComponent, {data:{bytes:0}});
  }

  async downloadFile(data, mime, filename) {
    // It is necessary to create a new blob object with mime-type explicitly set
    // otherwise only Chrome works like it should
    const blob = new Blob([data], {type: mime || 'application/octet-stream'});

    // Create a link pointing to the ObjectURL containing the blob
    const blobURL = window.URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = blobURL;
    tempLink.setAttribute('download', filename);

    // Safari thinks _blank anchor are pop ups. We only want to set _blank
    // target if the browser does not support the HTML5 download attribute.
    // This allows you to download files in desktop safari if pop up blocking
    // is enabled.
    if (typeof tempLink.download === 'undefined') {
      tempLink.setAttribute('target', '_blank');
    }

    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);

    setTimeout(() => {
      // For Firefox it is necessary to delay revoking the ObjectURL
      window.URL.revokeObjectURL(blobURL);
    }, 100);
  }

  closeFileTransferDialog() {
    this.dlgRef.close();
  }

  handleDragOverEvent(evt) {
    evt.preventDefault();
  }

  handleDropEvent(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    let files = evt.dataTransfer.files;
    Array.from(files).forEach((file: File) => {
      console.log("Transfer File Info: " + file.name + ":" + file.size + ":" + file.type);
      let response = new Promise((resolve, reject) => {
        resolve(AppComponent._self.processFile(file)); 
      });
    });
  }

  async processFile(file: File) {
    console.log("ProcessFile invoked");
    try {
      let reader = new FileReader();

      reader.onloadend = (evt) => {
        let arrayBuffer = reader.result;  
        AppComponent._self.sendDroppedFile(arrayBuffer, file); 
        reader = null;
      }

      reader.readAsArrayBuffer(file);
      //reader.readAsDataURL(file);
    } catch (err) {
      console.log("Error processing file: " + JSON.stringify(err));
    }
  }

  async sendDroppedFile(arrayBuffer, file) {
    console.log("sendDroppedFile " + file.name + " Size: " + file.size + " Type: " + file.type);

    const guacClient = this.guac;

    let output: Guacamole.OutputStream = guacClient.createFileStream(file.type, file.name);

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Demonstrate Bug Fix
    //
    // The Guacamole.BlobWriter has a bug in it....https://issues.apache.org/jira/browse/GUACAMOLE-827
    //let writer: Guacamole.BlobWriter = new Guacamole.BlobWriter(output);

    // Use the Caple.BlobWriter because it rocks
    let writer: Caple.BlobWriter = new Caple.BlobWriter(output);
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    let fileBlob = new Blob([arrayBuffer], {type: file.type || 'application/octet-stream'});
    writer.sendBlob(fileBlob);

    this.dlgRef = this.dialog.open(GuacDialogComponent, {data:{bytes:0}});

    writer.onack = (status) => {
      console.log("OnAck Status: " + status.message + ":" + status.code);
    }

    writer.oncomplete = (blob) => {
      console.log("Blob write oncomplete invoked");
      writer.sendEnd();
      this.closeFileTransferDialog();
    }

    writer.onerror = (blob, offset, error) => {
      console.log("OnError Offset => " + offset);
      console.log("OnError error => " + JSON.stringify(error));
      writer.sendEnd();
      this.closeFileTransferDialog();
    }

    writer.onprogress = (blob, offset) => {
      console.log("OnProgress offset: " + offset);
      this.dlgRef.componentInstance.bytes_transferred = offset;
    }

    this.closeFileTransferDialog = () => {
      setTimeout(() => {
        this.dlgRef.close();
      }, 1000);
    }
  }
  
}
