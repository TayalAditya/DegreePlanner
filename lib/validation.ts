// Input validation and sanitization utilities

import DOMPurify from "isomorphic-dompurify";

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Sanitize HTML to prevent XSS
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
    ALLOWED_ATTR: ["href"],
  });
}

// Validate email format
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate enrollment ID format (example: 2020CSXXXXX)
export function validateEnrollmentId(id: string): boolean {
  const enrollmentRegex = /^20\d{2}[A-Z]{2,4}\d{5,6}$/;
  return enrollmentRegex.test(id);
}

// Validate time format (HH:MM)
export function validateTimeFormat(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

// Validate time range (start before end)
export function validateTimeRange(startTime: string, endTime: string): boolean {
  if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
    return false;
  }

  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return endMinutes > startMinutes;
}

// Validate file upload
export function validateFileUpload(
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const { maxSizeMB = 10, allowedTypes = ["application/pdf", "image/jpeg", "image/png"] } = options;

  if (file.size > maxSizeMB * 1024 * 1024) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type must be one of: ${allowedTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

// Sanitize filename for safe storage
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 255);
}

// Validate semester number
export function validateSemester(semester: number): boolean {
  return Number.isInteger(semester) && semester >= 1 && semester <= 10;
}

// Validate credit value
export function validateCredits(credits: number): boolean {
  return Number.isFinite(credits) && credits >= 0 && credits <= 50;
}

// Validate branch code
export function validateBranchCode(code: string): boolean {
  const validBranches = [
    "CSE", "ECE", "EEE", "MECH", "CIVIL", "CHE",
    "BIO", "PHARMA", "ENI", "CHEM", "MATH", "BS"
  ];
  return validBranches.includes(code);
}

// SQL injection prevention (for raw queries - prefer Prisma)
export function escapeSQLString(str: string): string {
  return str.replace(/'/g, "''");
}

// Validate URL format
export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Rate limit key generation
export function generateRateLimitKey(ip: string, endpoint: string): string {
  return `ratelimit:${endpoint}:${ip}`;
}

// Password strength validation (for future use)
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push("Password must be at least 8 characters");

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password)) score++;
  else feedback.push("Include lowercase letters");

  if (/[A-Z]/.test(password)) score++;
  else feedback.push("Include uppercase letters");

  if (/[0-9]/.test(password)) score++;
  else feedback.push("Include numbers");

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push("Include special characters");

  return {
    valid: score >= 4,
    score,
    feedback,
  };
}
