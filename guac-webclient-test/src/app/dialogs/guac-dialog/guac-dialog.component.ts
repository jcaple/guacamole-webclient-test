import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material';

@Component({
  selector: 'app-guac-dialog',
  templateUrl: './guac-dialog.component.html',
  styleUrls: ['./guac-dialog.component.css']
})
export class GuacDialogComponent implements OnInit {

  public bytes_transferred = 0;

  constructor(@Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {
  }

  public updateBytesTransferred(bytes) {
    this.bytes_transferred = bytes;
  }

}
