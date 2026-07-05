import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OtpInput } from './otp-input';

function boxes() {
  return screen.getAllByRole('textbox');
}

describe('OtpInput', () => {
  it('renderiza uma caixa por dígito', () => {
    render(<OtpInput length={6} value="" onChange={vi.fn()} />);

    expect(boxes()).toHaveLength(6);
  });

  it('mostra cada dígito na caixa correspondente', () => {
    render(<OtpInput length={6} value="12345" onChange={vi.fn()} />);

    const inputs = boxes() as HTMLInputElement[];
    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '']);
  });

  it('digitar um dígito avança o foco pra próxima caixa', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput length={6} value="" onChange={onChange} />);

    await user.type(boxes()[0], '4');

    expect(onChange).toHaveBeenCalledWith('4');
    expect(boxes()[1]).toHaveFocus();
  });

  it('backspace numa caixa vazia limpa a anterior e volta o foco', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput length={6} value="12" onChange={onChange} />);

    boxes()[2].focus();
    await user.keyboard('{Backspace}');

    expect(onChange).toHaveBeenCalledWith('1');
    expect(boxes()[1]).toHaveFocus();
  });

  it('distribui os dígitos quando cola o código inteiro numa caixa', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput length={6} value="" onChange={onChange} />);

    await user.click(boxes()[0]);
    await user.paste('123456');

    expect(onChange).toHaveBeenCalledWith('123456');
  });
});
