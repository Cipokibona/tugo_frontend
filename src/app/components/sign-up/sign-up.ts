import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServiceApi } from '../../services/service-api';
import { error } from 'console';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sign-up',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.scss',
})
export class SignUp implements OnInit{
  registerForm!: FormGroup;
  loading = false;
  errorMessage: string | null = null;

  constructor(private fb: FormBuilder, private service: ServiceApi , private router: Router) {
    this.registerForm = this.fb.group(
      {
        firstname: ['', [Validators.required, Validators.minLength(3)]],
        contact_number: ['', [Validators.required]],
        username: ['', [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(4)]],
        confirmPassword: ['', [Validators.required]]
      },
      {
        validators: this.passwordsMatchValidator
      }
    );
  }

  ngOnInit(): void {

  }


  passwordsMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    return password === confirmPassword ? null : { passwordsMismatch: true };
  }

  submit(): void {
    if (this.registerForm.invalid || this.passwordsMatchValidator(this.registerForm)) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    const payload = {
      first_name: this.registerForm.value.firstname,
      contact_number: this.registerForm.value.contact_number,
      username: this.registerForm.value.username,
      password: this.registerForm.value.password
    };
    console.log('Register payload:', payload);

    this.service.createUser(payload).subscribe({
      next: (response) => {
        console.log('API response:', response);
        // this.router.navigate(['/login']);
        // LOGIN AUTOMATIQUE APRES CREATION

        this.service.login(payload.username, payload.password).subscribe({
        next: () => {

          this.loading = false;

          // redirection vers home
          this.router.navigate(['/home']).then(() => {
            window.location.reload();
            console.log('Navigation to /home successful');
          });
        },
        error: () => {
          this.loading = false;
          this.showError('Account created but auto-login failed');
        }
      });
      },
      error: (err) => {
        console.error('API error:', err);
        this.loading = false;
        setTimeout(() => {
          this.showError('Registration failed. Try again.');
        }, 1000);
      }
    });
  }

  showError(message: string, duration = 3000) {
    this.errorMessage = message;

    setTimeout(() => {
      this.errorMessage = null;
    }, duration);
  }

  cancel(): void {
    this.registerForm.reset();
  }

  /** Helpers */
  get f() {
    return this.registerForm.controls;
  }
}
