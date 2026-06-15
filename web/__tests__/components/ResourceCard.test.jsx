import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PlatformBadge from '../../src/components/PlatformBadge';
import TypeBadge from '../../src/components/TypeBadge';
import TagChip from '../../src/components/TagChip';

describe('PlatformBadge', () => {
  it('renders WorkBuddy badge', () => {
    render(<PlatformBadge platform="workbuddy" />);
    expect(screen.getByText('WorkBuddy')).toBeTruthy();
  });

  it('renders Cursor badge', () => {
    render(<PlatformBadge platform="cursor" />);
    expect(screen.getByText('Cursor')).toBeTruthy();
  });

  it('renders Claude Code badge', () => {
    render(<PlatformBadge platform="claude" />);
    expect(screen.getByText('Claude Code')).toBeTruthy();
  });
});

describe('TypeBadge', () => {
  it('renders skill type', () => {
    render(<TypeBadge type="skill" />);
    expect(screen.getByText('技能')).toBeTruthy();
  });

  it('renders rules type', () => {
    render(<TypeBadge type="rules" />);
    expect(screen.getByText('规则')).toBeTruthy();
  });
});

describe('TagChip', () => {
  it('renders tag label', () => {
    render(<TagChip label="sql" />);
    expect(screen.getByText('sql')).toBeTruthy();
  });
});
