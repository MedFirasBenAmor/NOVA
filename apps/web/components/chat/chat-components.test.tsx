import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressStepper } from './progress-stepper';
import { AnalysisProgressCard } from './analysis-progress-card';
import { SuggestionChips } from './suggestion-chips';
import { NovaAssistantAvatar } from './nova-assistant-avatar';
import { AssistantMessage } from './assistant-message';
import { UserMessage } from './user-message';
import { Transcript } from './transcript';
import type { ChatMessage } from '@/lib/chat-helpers';

afterEach(cleanup);

describe('ProgressStepper', () => {
  it('marks the derived stage as current without faking progress', () => {
    render(<ProgressStepper activeStep={2} />);
    const active = screen.getByText('Analyse & options');
    expect(active.closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Décrivez votre situation').closest('li')).not.toHaveAttribute(
      'aria-current',
    );
  });
});

describe('AnalysisProgressCard', () => {
  it('renders the real analysis rows and announces them politely', () => {
    render(<AnalysisProgressCard />);
    expect(screen.getByText(/je commence à analyser/i)).toBeInTheDocument();
    expect(screen.getByText('Compréhension de votre situation')).toBeInTheDocument();
    expect(screen.getByText('Extraction des informations clés')).toBeInTheDocument();
    expect(screen.getByText('Recherche des meilleures options')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('SuggestionChips', () => {
  it('forwards a picked suggestion to the composer handler', () => {
    const onPick = vi.fn();
    render(<SuggestionChips onPick={onPick} />);
    fireEvent.click(screen.getByText('J’ai une nouvelle voiture'));
    expect(onPick).toHaveBeenCalledWith('J’ai une nouvelle voiture');
  });
});

describe('conversation bubbles', () => {
  it('renders an assistant avatar alongside NOVA copy', () => {
    render(
      <AssistantMessage>
        <span>Salut !</span>
      </AssistantMessage>,
    );
    expect(screen.getByText('Salut !')).toBeInTheDocument();
  });

  it('renders user copy in a right-aligned bubble', () => {
    render(<UserMessage>J’ai une nouvelle voiture</UserMessage>);
    expect(screen.getByText('J’ai une nouvelle voiture')).toBeInTheDocument();
  });

  it('renders the avatar at the requested size without crashing', () => {
    const { container } = render(<NovaAssistantAvatar size="lg" />);
    expect(container.firstChild).not.toBeNull();
  });
});

describe('Transcript scrolling', () => {
  const scrollIntoView = vi.fn();
  const messages: ChatMessage[] = [
    { id: 'm1', role: 'NOVA', content: 'Bonjour' },
  ];
  const props = {
    action: undefined,
    messages,
    analyzing: false,
    onRetry: vi.fn(),
    onPickSuggestion: vi.fn(),
    onAnswer: vi.fn(),
    onDecision: vi.fn(),
    onReviewEdit: vi.fn(),
    onUpload: vi.fn(),
    busy: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setScrollState(
    element: HTMLElement,
    state: { scrollHeight: number; clientHeight: number; scrollTop: number },
  ) {
    Object.defineProperty(element, 'scrollHeight', {
      configurable: true,
      value: state.scrollHeight,
    });
    Object.defineProperty(element, 'clientHeight', {
      configurable: true,
      value: state.clientHeight,
    });
    Object.defineProperty(element, 'scrollTop', {
      configurable: true,
      value: state.scrollTop,
      writable: true,
    });
  }

  it('uses a dedicated conversation scroll container and restores at the latest message', () => {
    render(<Transcript {...props} />);
    const container = screen.getByTestId('conversation-scroll');
    expect(container).toHaveClass('overflow-y-auto');
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'end',
    });
  });

  it('auto-scrolls for a newly submitted user message even after the user scrolled up', () => {
    const { rerender } = render(<Transcript {...props} />);
    const container = screen.getByTestId('conversation-scroll');
    scrollIntoView.mockClear();
    setScrollState(container, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 100,
    });
    fireEvent.scroll(container);
    rerender(
      <Transcript
        {...props}
        messages={[
          ...messages,
          { id: 'm2', role: 'CUSTOMER', content: 'J’ai une nouvelle voiture' },
        ]}
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'end',
    });
  });

  it('auto-scrolls a new assistant action only when already near bottom', () => {
    const { rerender } = render(<Transcript {...props} />);
    const container = screen.getByTestId('conversation-scroll');
    scrollIntoView.mockClear();
    setScrollState(container, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 500,
    });
    fireEvent.scroll(container);
    rerender(
      <Transcript
        {...props}
        messages={[
          ...messages,
          { id: 'm2', role: 'NOVA', content: 'Question suivante' },
        ]}
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'end',
    });
  });

  it('does not force assistant updates to bottom while the user is reading older messages', () => {
    const { rerender } = render(<Transcript {...props} />);
    const container = screen.getByTestId('conversation-scroll');
    scrollIntoView.mockClear();
    setScrollState(container, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 100,
    });
    fireEvent.scroll(container);
    rerender(
      <Transcript
        {...props}
        messages={[
          ...messages,
          { id: 'm2', role: 'NOVA', content: 'Nouvelle réponse' },
        ]}
      />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
