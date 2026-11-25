import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';
import i18n from '../../app/i18n.js';
import { istNowLocal, formatLocalTime } from '../../lib/dates.js';
import { validateEvent, eventPayload, eventToState } from './components/EventForm.jsx';
import { checkEvidenceFile } from '../media/api.js';
import { uploadEvidence } from '../media/api.js';

vi.mock('../media/api.js', async (importOriginal) => ({ ...(await importOriginal()), uploadEvidence: vi.fn() }));
beforeEach(() => {
  uploadEvidence.mockReset();
});

const cat = { id: 'c1', name: { en: 'Festival', te: 'పండుగ' }, slug: 'festival', type: 'event', parentId: null, sortOrder: 1, isActive: true };

const event = (o = {}) => ({
  id: 'e1',
  slug: 'kartika-deepotsavam',
  title: 'Kartika Deepotsavam',
  description: 'Lamps along the canal.',
  category: { id: 'c1', name: cat.name, slug: 'festival' },
  startAt: '2026-11-30T12:30:00.000Z',
  endAt: '2026-11-30T15:30:00.000Z',
  startLocal: '2026-11-30T18:00',
  endLocal: '2026-11-30T21:00',
  allDay: false,
  venue: { name: 'Canal Ghat', address: 'Canal Road', area: 'Bose Road' },
  location: null,
  bannerImage: null,
  bookingUrl: 'https://tickets.example.com/dd',
  priceInfo: 'Free entry',
  organizerName: 'Tenali Cultural Trust',
  business: null,
  isSeed: false,
  isCancelled: false,
  cancelReason: null,
  ...o,
});
const page = (items, meta = {}) => ok(items, { page: 1, limit: 20, total: items.length, totalPages: 1, ...meta });

const evidence = (o = {}) => ({
  id: 'ev1',
  kind: 'poster',
  note: '',
  filename: 'poster.jpg',
  format: 'jpg',
  bytes: 200_000,
  pages: null,
  isImage: true,
  status: 'active',
  ...o,
});
const submission = (o = {}) => ({
  ...event(),
  status: 'pending_review',
  source: 'community',
  revision: 1,
  review: null,
  canEdit: true,
  evidence: [evidence()],
  ...o,
});

describe('event form rules (IST)', () => {
  const base = () => ({
    ...eventToState(),
    title: 'Music night',
    categoryId: 'c1',
    startAt: '2026-12-01T18:00',
    endAt: '2026-12-01T21:00',
    venueName: 'Town Hall',
    venueAddress: 'Main Road',
    area: 'Bose Road',
    organizerName: 'Trust',
  });
  const now = new Date('2026-11-25T10:00:00+05:30');

  it('accepts a valid event and rejects end-before-start, >90 days, ended, bad URL and half a map point', () => {
    expect(validateEvent(base(), { now })).toEqual({});
    expect(validateEvent({ ...base(), endAt: '2026-12-01T17:00' }, { now }).endAt).toBe('events.v.endBeforeStart');
    expect(validateEvent({ ...base(), endAt: '2027-03-15T10:00' }, { now }).endAt).toBe('events.v.tooLong');
    expect(validateEvent({ ...base(), startAt: '2026-11-25T08:00', endAt: '2026-11-25T09:59' }, { now }).endAt).toBe('events.v.over');
    expect(validateEvent({ ...base(), bookingUrl: 'http://x.com' }, { now }).bookingUrl).toBe('events.v.bookingUrl');
    expect(validateEvent({ ...base(), lat: '16.2' }, { now }).location).toBe('events.v.location');
  });

  it('all-day events send 00:00-23:59 IST and edits clear optional fields with null', () => {
    const p = eventPayload({ ...base(), allDay: true, startAt: '2026-12-01T00:00', endAt: '2026-12-02T00:00' }, { editing: true });
    expect(p).toMatchObject({ allDay: true, startAt: '2026-12-01T00:00', endAt: '2026-12-02T23:59', bookingUrl: null, location: null, businessId: null });
    expect(p).not.toHaveProperty('bannerImage'); // submitters can never set a banner
    expect(eventPayload(base())).not.toHaveProperty('bookingUrl');
  });

  it('formats IST local times and gives "now" in IST', () => {
    expect(istNowLocal(new Date('2026-11-25T19:00:00Z'))).toBe('2026-11-26T00:30');
    expect(formatLocalTime('2026-11-30T18:00', 'en').toLowerCase()).toContain('6:00');
  });

  it('checks evidence files by type and size', () => {
    const f = (type, size) => ({ type, size, name: 'x' });
    expect(checkEvidenceFile(f('image/jpeg', 1000))).toBeNull();
    expect(checkEvidenceFile(f('application/pdf', 9 * 1024 * 1024))).toBeNull();
    expect(checkEvidenceFile(f('image/png', 6 * 1024 * 1024))).toBe('evidence.v.imageSize');
    expect(checkEvidenceFile(f('application/pdf', 11 * 1024 * 1024))).toBe('evidence.v.pdfSize');
    expect(checkEvidenceFile(f('application/zip', 10))).toBe('evidence.v.type');
  });
});

describe('/events list and detail', () => {
  it('lists events with date, time, venue and cancelled label, and sends filters', async () => {
    const { calls } = mockApi({
      'GET /events': () => page([event(), event({ id: 'e2', slug: 'x', title: 'Rained out', isCancelled: true })]),
      'GET /categories': () => ok([cat]),
    });
    const { router } = renderApp('/events');
    const user = userEvent.setup();
    const card = (await screen.findByText('Kartika Deepotsavam')).closest('a');
    expect(card).toHaveAttribute('href', '/events/kartika-deepotsavam');
    expect(within(card).getByText('Canal Ghat • Bose Road')).toBeInTheDocument();
    expect(within(screen.getByText('Rained out').closest('a')).getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('2 events')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Know about an event/ })).toHaveAttribute('href', '/events/submit');

    await user.click(await screen.findByRole('button', { name: 'Festival' }));
    await user.click(screen.getByLabelText('Show past events (last 90 days)'));
    await waitFor(() => expect(router.state.location.search).toContain('includePast=true'));
    await waitFor(() => expect(calls.filter((c) => c.path === '/events').at(-1).query).toMatchObject({ categoryId: 'c1', includePast: 'true' }));
  });

  it('shows the empty state', async () => {
    mockApi({ 'GET /events': () => page([]), 'GET /categories': () => ok([]) });
    renderApp('/events');
    expect(await screen.findByText('No upcoming events')).toBeInTheDocument();
  });

  it('shows detail with booking link, organiser and cancellation reason', async () => {
    mockApi({ 'GET /events/kartika-deepotsavam': () => ok(event()) });
    const { unmount } = renderApp('/events/kartika-deepotsavam');
    expect(await screen.findByRole('heading', { level: 2, name: 'Kartika Deepotsavam' })).toBeInTheDocument();
    expect(screen.getByText('Organised by Tenali Cultural Trust')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Book \/ register/ })).toHaveAttribute('href', 'https://tickets.example.com/dd');
    unmount();

    mockApi({ 'GET /events/kartika-deepotsavam': () => ok(event({ isCancelled: true, cancelReason: 'Postponed due to rain.' })) });
    renderApp('/events/kartika-deepotsavam');
    expect(await screen.findByText('This event has been cancelled')).toBeInTheDocument();
    expect(screen.getByText('Postponed due to rain.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Book \/ register/ })).not.toBeInTheDocument();
  });

  it('shows a not-available page for unknown or private events, and Telugu labels', async () => {
    mockApi({ 'GET /events/nope': () => ({ status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'x' } } }) });
    const { unmount } = renderApp('/events/nope');
    expect(await screen.findByText('Event not available')).toBeInTheDocument();
    unmount();

    mockApi({ 'GET /events': () => page([event({ allDay: true })]), 'GET /categories': () => ok([cat]) });
    await i18n.changeLanguage('te');
    renderApp('/events');
    expect(await screen.findByRole('heading', { name: 'కార్యక్రమాలు & కార్యకలాపాలు' })).toBeInTheDocument();
    expect(await screen.findByText(/రోజంతా/)).toBeInTheDocument();
  });
});

describe('submitting an event', () => {
  it('requires sign-in', async () => {
    const { router } = renderApp('/events/submit');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('uploads private evidence with progress and submits with it; never sends a banner', async () => {
    let finish;
    uploadEvidence.mockImplementation((file, { onProgress }) => {
      onProgress(40);
      return new Promise((resolve) => {
        finish = () => resolve({ publicId: 'mana-tenali/evidence/u_u1/abc', format: 'jpg', bytes: file.size });
      });
    });
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'GET /categories': () => ok([cat]),
      'GET /businesses': () => page([]),
      'POST /events/submissions': ({ body }) => ok(submission({ id: 'new1', title: body.title })),
      'GET /events/submissions/new1': () => ok(submission({ id: 'new1' })),
    });
    const { router } = renderApp('/events/submit');
    const user = userEvent.setup();
    expect(await screen.findByText(/Only you and the Mana Tenali team can see these files/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Event name *'), 'Music night');
    await user.selectOptions(await screen.findByLabelText('Category *'), 'c1');
    await user.type(screen.getByLabelText('Starts *'), '2030-12-01T18:00');
    await user.type(screen.getByLabelText('Ends *'), '2030-12-01T21:00');
    await user.type(screen.getByLabelText('Venue name *'), 'Town Hall');
    await user.type(screen.getByLabelText('Venue address *'), 'Main Road');
    await user.selectOptions(screen.getByLabelText('Area *'), 'Bose Road');
    await user.type(screen.getByLabelText('Organiser *'), 'Tenali Trust');

    // Submitting without evidence is blocked.
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(await screen.findByText('Please fix the highlighted fields.')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/events/submissions' && c.method === 'POST')).toBe(false);

    const file = new File(['x'.repeat(100)], 'poster.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Add files'), file);
    expect(await screen.findByRole('progressbar', { name: 'poster.jpg' })).toHaveAttribute('aria-valuenow', '40');
    finish();
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Type - poster.jpg'), 'venue_confirmation');

    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/events/submissions/new1'));
    const sent = calls.find((c) => c.method === 'POST' && c.path === '/events/submissions').body;
    expect(sent).toMatchObject({
      title: 'Music night',
      startAt: '2030-12-01T18:00',
      venue: { name: 'Town Hall', address: 'Main Road', area: 'Bose Road' },
      evidence: [{ publicId: 'mana-tenali/evidence/u_u1/abc', kind: 'venue_confirmation', filename: 'poster.jpg' }],
    });
    expect(sent).not.toHaveProperty('bannerImage');
    expect(sent).not.toHaveProperty('status');
  });

  it('rejects disallowed evidence files before upload', async () => {
    mockApi({ 'GET /auth/me': () => ok(sampleUser()), 'GET /categories': () => ok([cat]), 'GET /businesses': () => page([]) });
    renderApp('/events/submit');
    const user = userEvent.setup({ applyAccept: false });
    const big = new File(['x'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    await user.upload(await screen.findByLabelText('Add files'), big);
    expect(await screen.findByText('Images can be at most 5 MB.')).toBeInTheDocument();
    expect(uploadEvidence).not.toHaveBeenCalled();
  });
});

describe('my submissions', () => {
  it('shows status and reviewer note; resubmits after changes requested', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'GET /events/submissions/mine': () => ok([submission({ status: 'changes_requested', review: { outcome: 'changes_requested', note: 'Please add the venue letter.' } })]),
      'GET /events/submissions/e1': () =>
        ok(submission({ status: 'changes_requested', review: { outcome: 'changes_requested', note: 'Please add the venue letter.' } })),
      'GET /categories': () => ok([cat]),
      'GET /businesses': () => page([]),
      'POST /events/submissions/e1/resubmit': () => ok(submission()),
    });
    renderApp('/events/submissions');
    const user = userEvent.setup();
    const row = (await screen.findByText('Kartika Deepotsavam')).closest('a');
    expect(within(row).getByText('Changes requested')).toBeInTheDocument();
    expect(within(row).getByText('Please add the venue letter.')).toBeInTheDocument();
    await user.click(row);
    await user.click(await screen.findByRole('button', { name: 'Resubmit for review' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/events/submissions/e1/resubmit')).toBe(true));
  });

  it('opens private evidence only via a short-lived link and never shows PDFs inline', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'GET /events/submissions/e1': () =>
        ok(submission({ evidence: [evidence(), evidence({ id: 'ev2', kind: 'document', filename: 'letter.pdf', format: 'pdf', isImage: false, pages: 2 })] })),
      'GET /categories': () => ok([cat]),
      'GET /businesses': () => page([]),
      'POST /events/submissions/e1/evidence/ev1/access': () => ok({ previewUrl: 'https://res.cloudinary.com/p/private/ev1.jpg', downloadUrl: 'https://api.cloudinary.com/dl/ev1' }),
      'POST /events/submissions/e1/evidence/ev2/access': () => ok({ previewUrl: null, downloadUrl: 'https://api.cloudinary.com/dl/ev2' }),
    });
    renderApp('/events/submissions/e1');
    const user = userEvent.setup();
    expect(await screen.findByText(/letter\.pdf • PDF/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /poster/i })).not.toBeInTheDocument(); // nothing loaded until asked

    expect(screen.queryByRole('button', { name: 'Preview Event document / confirmation' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download Event document / confirmation' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://api.cloudinary.com/dl/ev2', '_blank', 'noopener,noreferrer'));

    await user.click(screen.getByRole('button', { name: 'Preview Poster or flyer' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://res.cloudinary.com/p/private/ev1.jpg');
    expect(calls.filter((c) => c.path.endsWith('/access'))).toHaveLength(2);
  });

  it('shows a read-only final state for rejected submissions', async () => {
    mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'GET /events/submissions/e1': () => ok(submission({ status: 'rejected', canEdit: false, review: { outcome: 'rejected', note: 'Could not verify the organiser.' } })),
    });
    renderApp('/events/submissions/e1');
    expect(await screen.findByText('Could not verify the organiser.')).toBeInTheDocument();
    expect(screen.getByText('This submission was not approved and can’t be changed.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});

describe('admin moderation', () => {
  const review = (o = {}) => ({
    ...submission(),
    businessId: null,
    submitter: { id: 'u1', name: 'Ravi Kumar', email: 'ravi@example.com' },
    submittedAt: '2026-11-24T05:00:00.000Z',
    moderationLog: [{ action: 'submitted', at: '2026-11-24T05:00:00.000Z', actor: 'Ravi Kumar', fromStatus: null, toStatus: 'pending_review' }],
    ...o,
  });

  it('is admin-only', async () => {
    mockApi({ 'GET /auth/me': () => ok(sampleUser()) });
    renderApp('/admin/event-submissions');
    expect((await screen.findAllByText('Not allowed')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Event submissions')).not.toBeInTheDocument();
  });

  it('lists the queue and requires a reason to reject', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/event-submissions': () => page([{ id: 'e1', title: 'Kartika Deepotsavam', status: 'pending_review', startLocal: '2026-11-30T18:00', area: 'Bose Road', revision: 2, submitter: { name: 'Ravi Kumar' }, submittedAt: '2026-11-24T05:00:00.000Z' }]),
      'GET /admin/event-submissions/e1': () => ok(review()),
      'POST /admin/event-submissions/e1/reject': () => ok(review({ status: 'rejected' })),
    });
    renderApp('/admin/event-submissions');
    const user = userEvent.setup();
    const row = (await screen.findByText('Kartika Deepotsavam')).closest('a');
    expect(within(row).getByText(/Version 2/)).toBeInTheDocument();
    await user.click(row);
    expect(await screen.findByText(/ravi@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Private evidence\. Links are created on demand/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog).findByText('Please write at least 5 characters.')).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/reject'))).toBe(false);
    await user.type(within(dialog).getByLabelText('Reason (shown to the submitter)'), 'Could not verify the organiser.');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/reject'))?.body).toEqual({ reason: 'Could not verify the organiser.' }));
  });

  it('approves and sends a change request', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/event-submissions/e1': () => ok(review()),
      'GET /admin/event-submissions': () => page([]),
      'POST /admin/event-submissions/e1/approve': () => ok(review({ status: 'published' })),
      'POST /admin/event-submissions/e1/request-changes': () => ok(review({ status: 'changes_requested' })),
    });
    const { unmount } = renderApp('/admin/event-submissions/e1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/approve'))?.body).toEqual({}));
    unmount();

    renderApp('/admin/event-submissions/e1');
    await user.click(await screen.findByRole('button', { name: 'Request changes' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/What should the submitter change/), 'Add the venue letter.');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/request-changes'))?.body).toEqual({ note: 'Add the venue letter.' }));
  });

  it('cancels a published event with a public reason', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/events': () => page([{ id: 'e1', title: 'Kartika Deepotsavam', status: 'published', source: 'admin', startLocal: '2026-11-30T18:00', area: 'Bose Road' }]),
      'PATCH /events/e1': ({ body }) => ok({ ...event(), status: body.status }),
    });
    renderApp('/admin/events');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Cancel event Kartika Deepotsavam' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Reason (shown publicly)'), 'Postponed due to rain.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel event' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'cancelled', cancelReason: 'Postponed due to rain.' }));
  });
});

describe('linked business', () => {
  it('uses the business location as the default map point', async () => {
    mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'GET /categories': () => ok([cat]),
      'GET /businesses': () => page([{ id: 'b1', name: 'Town Hall Caterers', location: { lat: 16.2391, lng: 80.6417 } }]),
    });
    renderApp('/events/submit');
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText('Linked business (optional)'), await screen.findByRole('option', { name: 'Town Hall Caterers' }));
    expect(screen.getByLabelText('Latitude')).toHaveValue(16.2391);
    expect(screen.getByLabelText('Longitude')).toHaveValue(80.6417);
  });
});
