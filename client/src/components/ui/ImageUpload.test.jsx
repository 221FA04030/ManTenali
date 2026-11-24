import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render.jsx';
import { mockApi, ok } from '../../test/mockApi.js';
import { ImageUpload } from './ImageUpload.jsx';
import { cldUrl } from '../../lib/cloudinary.js';

const signed = {
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
  cloudName: 'demo',
  apiKey: 'k123',
  params: { timestamp: 1, folder: 'mana-tenali/avatars', allowed_formats: 'jpg,jpeg,png,webp', transformation: 'c_limit,w_600,h_600' },
  signature: 'sig',
  maxBytes: 2 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
};

const file = (name, type, size) => new File([new Uint8Array(size)], name, { type });

function setup(handlers) {
  const { calls, fetchMock } = mockApi(handlers);
  const onChange = vi.fn();
  renderWithProviders(<ImageUpload purpose="avatar" onChange={onChange} label="Photo" />);
  return { calls, fetchMock, onChange, user: userEvent.setup({ applyAccept: false }) };
}

describe('ImageUpload', () => {
  it('signs, uploads directly to Cloudinary and returns { url, publicId }', async () => {
    const { calls, fetchMock, onChange, user } = setup({
      'POST /media/sign': () => ok(signed),
    });
    const realImpl = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).startsWith('https://api.cloudinary.com')) {
        const form = init.body;
        expect(form.get('api_key')).toBe('k123');
        expect(form.get('signature')).toBe('sig');
        expect(form.get('folder')).toBe('mana-tenali/avatars');
        expect(init.credentials).toBeUndefined(); // our session cookie is never sent to Cloudinary
        return new Response(
          JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/mana-tenali/avatars/a.jpg', public_id: 'mana-tenali/avatars/a' }),
          { status: 200 },
        );
      }
      return realImpl(input, init);
    });

    await user.upload(await screen.findByLabelText('Photo'), file('me.png', 'image/png', 1000));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        url: 'https://res.cloudinary.com/demo/image/upload/v1/mana-tenali/avatars/a.jpg',
        publicId: 'mana-tenali/avatars/a',
      }),
    );
    expect(calls.find((c) => c.path === '/media/sign').body).toEqual({ purpose: 'avatar' });
  });

  it('rejects wrong types and oversized files before contacting the server', async () => {
    const { calls, onChange, user } = setup();
    const input = await screen.findByLabelText('Photo');
    await user.upload(input, file('doc.pdf', 'application/pdf', 100));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only JPG, PNG or WebP');
    await user.upload(input, file('big.jpg', 'image/jpeg', 3 * 1024 * 1024));
    expect(await screen.findByRole('alert')).toHaveTextContent('larger than 2 MB');
    expect(calls.some((c) => c.path === '/media/sign')).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('explains when uploads are not configured on the server', async () => {
    const { user } = setup({
      'POST /media/sign': () => ({ status: 503, body: { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'x' } } }),
    });
    await user.upload(await screen.findByLabelText('Photo'), file('me.jpg', 'image/jpeg', 100));
    expect(await screen.findByRole('alert')).toHaveTextContent('Photo uploads are not available yet.');
  });
});

describe('cldUrl', () => {
  it('adds auto format/quality and resizing to Cloudinary URLs only', () => {
    expect(cldUrl('https://res.cloudinary.com/demo/image/upload/v1/x.jpg', { w: 400 })).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_400/v1/x.jpg',
    );
    expect(cldUrl('https://lh3.googleusercontent.com/a/x', { w: 100 })).toBe('https://lh3.googleusercontent.com/a/x');
    expect(cldUrl(null)).toBeNull();
  });
});
