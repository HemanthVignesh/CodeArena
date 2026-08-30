export interface ValidationError {
  field: string;
  message: string;
}

export function validateRegistrationInput(input: {
  email?: string;
  username?: string;
  password?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  // Email validation
  if (!input.email || typeof input.email !== "string") {
    errors.push({ field: "email", message: "Email address is required." });
  } else {
    const email = input.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push({
        field: "email",
        message: "Please provide a valid email address.",
      });
    } else if (email.length > 255) {
      errors.push({
        field: "email",
        message: "Email address must not exceed 255 characters.",
      });
    }
  }

  // Username validation
  if (!input.username || typeof input.username !== "string") {
    errors.push({ field: "username", message: "Username is required." });
  } else {
    const username = input.username.trim();
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      errors.push({
        field: "username",
        message:
          "Username must be 3-20 characters and contain only letters, numbers, and underscores.",
      });
    }
  }

  // Password validation
  if (!input.password || typeof input.password !== "string") {
    errors.push({ field: "password", message: "Password is required." });
  } else {
    const password = input.password;
    if (password.length < 8) {
      errors.push({
        field: "password",
        message: "Password must be at least 8 characters long.",
      });
    } else if (password.length > 128) {
      errors.push({
        field: "password",
        message: "Password must not exceed 128 characters.",
      });
    } else if (
      !/[0-9]/.test(password) &&
      !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    ) {
      errors.push({
        field: "password",
        message:
          "Password must contain at least one number or special character.",
      });
    }
  }

  return errors;
}

export function validateLoginInput(input: {
  login?: string;
  password?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (
    !input.login ||
    typeof input.login !== "string" ||
    input.login.trim().length === 0
  ) {
    errors.push({ field: "login", message: "Username or email is required." });
  }

  if (
    !input.password ||
    typeof input.password !== "string" ||
    input.password.length === 0
  ) {
    errors.push({ field: "password", message: "Password is required." });
  }

  return errors;
}
