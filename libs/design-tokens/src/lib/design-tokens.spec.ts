import { designTokens } from './design-tokens';

describe('designTokens', () => {
  it('should export accent token', () => {
    expect(designTokens.accent).toBe('var(--accent)');
  });

  it('should export surface tokens', () => {
    expect(designTokens.surface0).toBe('var(--surface-0)');
    expect(designTokens.surface1).toBe('var(--surface-1)');
  });

  it('should export font-sans token', () => {
    expect(designTokens.fontSans).toBe('var(--font-sans)');
  });
});
