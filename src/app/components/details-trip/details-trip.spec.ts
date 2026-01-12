import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailsTrip } from './details-trip';

describe('DetailsTrip', () => {
  let component: DetailsTrip;
  let fixture: ComponentFixture<DetailsTrip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailsTrip]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetailsTrip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
