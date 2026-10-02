import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  customerRegistrationSchema,
  ownerRegistrationSchema,
  activeOrgSelectionSchema,
} from '@sportshub/validation';

describe('Authentication & Registration Validation Schemas — STEP 3', () => {
  describe('Login Validation Schema', () => {
    it('should validate valid email and password credentials', () => {
      const valid = {
        email: 'user@example.com',
        password: 'securePassword123',
      };
      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });

    it('should normalize and trim lowercase email addresses', () => {
      const input = {
        email: '  User.Name@Example.COM  ',
        password: 'securePassword123',
      };
      const result = loginSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user.name@example.com');
      }
    });

    it('should reject invalid email format', () => {
      const invalid = {
        email: 'not-an-email',
        password: 'securePassword123',
      };
      expect(loginSchema.safeParse(invalid).success).toBe(false);
    });

    it('should reject short passwords under 6 characters', () => {
      const invalid = {
        email: 'user@example.com',
        password: '123',
      };
      expect(loginSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('Customer Registration Schema', () => {
    it('should validate complete valid customer registration data', () => {
      const valid = {
        fullName: 'Kasun Bandara',
        email: 'kasun@example.com',
        phone: '+94 77 123 4567',
        password: 'password123',
        confirmPassword: 'password123',
      };
      const result = customerRegistrationSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject when confirm password does not match password', () => {
      const mismatch = {
        fullName: 'Kasun Bandara',
        email: 'kasun@example.com',
        password: 'password123',
        confirmPassword: 'differentPassword456',
      };
      const result = customerRegistrationSchema.safeParse(mismatch);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMsg = result.error.errors[0]?.message;
        expect(errorMsg).toContain('Passwords do not match');
      }
    });

    it('should reject empty full name', () => {
      const invalid = {
        fullName: '   ',
        email: 'kasun@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      };
      expect(customerRegistrationSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('Owner Registration Schema', () => {
    it('should validate owner onboarding with business name', () => {
      const valid = {
        fullName: 'Nimal Jayasuriya',
        email: 'nimal@arena.lk',
        phone: '+94 71 555 6789',
        organizationName: 'Lanka Sports Complex',
        password: 'ownerPassword123',
        confirmPassword: 'ownerPassword123',
      };
      const result = ownerRegistrationSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject empty organization name', () => {
      const invalid = {
        fullName: 'Nimal Jayasuriya',
        email: 'nimal@arena.lk',
        organizationName: '   ',
        password: 'ownerPassword123',
        confirmPassword: 'ownerPassword123',
      };
      expect(ownerRegistrationSchema.safeParse(invalid).success).toBe(false);
    });

    it('should reject password mismatch on owner registration', () => {
      const invalid = {
        fullName: 'Nimal Jayasuriya',
        email: 'nimal@arena.lk',
        organizationName: 'Lanka Sports Complex',
        password: 'ownerPassword123',
        confirmPassword: 'wrongPassword999',
      };
      expect(ownerRegistrationSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('Active Organization Selection Schema', () => {
    it('should validate valid UUID for organization switcher', () => {
      const valid = {
        organizationId: 'a0000000-0000-0000-0000-000000000001',
      };
      expect(activeOrgSelectionSchema.safeParse(valid).success).toBe(true);
    });

    it('should reject malformed or non-UUID organization ID', () => {
      const invalid = {
        organizationId: 'not-a-valid-uuid',
      };
      expect(activeOrgSelectionSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
