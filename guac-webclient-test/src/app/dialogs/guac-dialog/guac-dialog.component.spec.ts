import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GuacDialogComponent } from './guac-dialog.component';

describe('GuacDialogComponent', () => {
  let component: GuacDialogComponent;
  let fixture: ComponentFixture<GuacDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GuacDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GuacDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
