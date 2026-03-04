import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServiceApi } from '../../services/service-api';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppLanguage, LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {

  loginForm: FormGroup;
  loading = false;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private service: ServiceApi,
    private router: Router,
    public languageService: LanguageService
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  submit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { username, password } = this.loginForm.value;

    this.loading = true;
    this.errorMessage = null;

    this.service.login(username, password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/home']).then(() => {
          window.location.reload();
          console.log('Navigation to /home successful');
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.detail || 'Username or password incorrect';
      }
    });

  }

  onLanguageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const language = target.value as AppLanguage;
    if (language === 'fr' || language === 'en') {
      this.languageService.setLanguage(language);
    }
  }
}
