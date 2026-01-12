import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormTrip } from './form-trip';

describe('FormTrip', () => {
  let component: FormTrip;
  let fixture: ComponentFixture<FormTrip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormTrip]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormTrip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
