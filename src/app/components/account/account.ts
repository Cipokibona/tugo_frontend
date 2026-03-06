import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ServiceApi } from '../../services/service-api';

@Component({
  selector: 'app-account',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account implements OnInit {
  userId: number | null = null;
  loadingProfile = true;
  savingProfile = false;
  savingPassword = false;
  profileMessage: string | null = null;
  profileError: string | null = null;
  passwordMessage: string | null = null;
  passwordError: string | null = null;

  profileForm: FormGroup;
  passwordForm: FormGroup;

  constructor(private fb: FormBuilder, private service: ServiceApi) {
    this.profileForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      username: ['', [Validators.required]],
      email: ['', [Validators.email]],
      contact_number: [''],
      city: [''],
      country: [''],
      age: [''],
      gender: [''],
    });

    this.passwordForm = this.fb.group(
      {
        current_password: ['', [Validators.required]],
        new_password: ['', [Validators.required, Validators.minLength(4)]],
        confirm_password: ['', [Validators.required]],
      },
      { validators: this.passwordsMatchValidator() }
    );
  }

  ngOnInit(): void {
    this.loadUser();
  }

  loadUser(): void {
    this.loadingProfile = true;
    this.service.getUser().subscribe({
      next: (user) => {
        this.userId = user?.id ?? null;
        this.profileForm.patchValue({
          first_name: user?.first_name ?? '',
          username: user?.username ?? '',
          email: user?.email ?? '',
          contact_number: user?.contact_number ?? '',
          city: user?.city ?? '',
          country: user?.country ?? '',
          age: user?.age ? String(user.age) : '',
          gender: user?.gender ?? '',
        });
        this.loadingProfile = false;
      },
      error: () => {
        this.loadingProfile = false;
        this.profileError = 'account.profile_error';
      },
    });
  }

  saveProfile(): void {
    this.profileMessage = null;
    this.profileError = null;

    if (this.profileForm.invalid || !this.userId) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile = true;
    const ageValue = String(this.profileForm.value.age ?? '').trim();
    const payload = {
      first_name: String(this.profileForm.value.first_name ?? '').trim(),
      username: String(this.profileForm.value.username ?? '').trim(),
      email: String(this.profileForm.value.email ?? '').trim(),
      contact_number: String(this.profileForm.value.contact_number ?? '').trim(),
      city: String(this.profileForm.value.city ?? '').trim(),
      country: String(this.profileForm.value.country ?? '').trim(),
      age: ageValue ? Number(ageValue) : null,
      gender: this.profileForm.value.gender || null,
    };

    this.service.patchUser(this.userId, payload).subscribe({
      next: () => {
        this.savingProfile = false;
        this.profileMessage = 'account.profile_saved';
      },
      error: () => {
        this.savingProfile = false;
        this.profileError = 'account.profile_error';
      },
    });
  }

  savePassword(): void {
    this.passwordMessage = null;
    this.passwordError = null;

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.savingPassword = true;
    const currentPassword = String(this.passwordForm.value.current_password ?? '');
    const newPassword = String(this.passwordForm.value.new_password ?? '');

    this.service.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.savingPassword = false;
        this.passwordMessage = 'account.password_saved';
        this.passwordForm.reset();
      },
      error: () => {
        this.savingPassword = false;
        this.passwordError = 'account.password_error';
      },
    });
  }

  private passwordsMatchValidator(): ValidatorFn {
    return (formGroup): ValidationErrors | null => {
      const newPassword = formGroup.get('new_password')?.value;
      const confirmPassword = formGroup.get('confirm_password')?.value;
      return newPassword === confirmPassword ? null : { passwordMismatch: true };
    };
  }
}
