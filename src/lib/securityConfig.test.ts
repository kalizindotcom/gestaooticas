import { describe, expect, it } from 'vitest';
import { assertPasswordPolicy, configuredCorsOrigin, minimumPasswordLength } from '../../server/securityConfig';

describe('security configuration', () => {
  it('rejects passwords below the minimum policy', () => {
    expect(() => assertPasswordPolicy('short')).toThrow(`pelo menos ${minimumPasswordLength}`);
  });

  it('accepts a strong password', () => {
    expect(() => assertPasswordPolicy('SenhaSegura123!')).not.toThrow();
  });

  it('allows origins in development', () => {
    expect(configuredCorsOrigin('http://localhost:5173')).toBe(true);
  });
});
