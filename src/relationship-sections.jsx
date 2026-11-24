import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  Camera,
  Flower2,
  Heart,
  Mail,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { deleteRecord, getAllRecords, getSetting, putRecord, setSetting } from "./relationship-storage.js";
import {
  deleteCloudLetter,
  deleteCloudTimelineEvent,
  fetchCloudLetters,
  fetchCloudRelationshipDate,
  fetchCloudTimeline,
  removeCloudSubscription,
  saveCloudLetter,
  saveCloudRelationshipDate,
  saveCloudTimelineEvent,
  subscribeToCoupleTable,
} from "./supabase-content.js";

const TIMELINE_STORE = "timelineEvents";
const LETTER_STORE = "loveLetters";
const EVENT_SEED_SETTING = "timeline-samples-created";
const LETTER_SEED_SETTING = "starter-letter-created";
const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
const STARTER_LETTER = {
  id: "starter-favorite-person",
  title: "To My Favorite Person",
  content: "I may not have the perfect words to describe what you mean to me, but I want you to know that every little moment with you is something I want to keep forever.\n\nThank you for being a beautiful part of my story.\n\nForever yours ❤️",
  date: todayLocal(),
  createdAt: 0,
};

const SAMPLE_EVENTS = [
  { id: "sample-meet", title: "The Day We Met", description: "The beginning of our story. Add the details that make this day yours.", date: "", createdAt: 1 },
  { id: "sample-first-photo", title: "Our First Photo", description: "The first picture we chose to keep close.", date: "", createdAt: 2 },
  { id: "sample-first-date", title: "Our First Date", description: "A day that deserves a place in our story.", date: "", createdAt: 3 },
  { id: "sample-special-memory", title: "A Special Memory", description: "One of those little moments that means everything.", date: "", createdAt: 4 },
  { id: "sample-best-moment", title: "Our Best Moment", description: "A favorite chapter, remembered in our own words.", date: "", createdAt: 5 },
  { id: "sample-forever", title: "Forever Together", description: "The story is still being written, one day at a time.", date: "", createdAt: 6 },
];

function makeId(prefix) {
  return `${prefix}-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dateValueLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sortEvents(items) {
  return [...items].sort((first, second) => {
    if (first.date && second.date) return first.date.localeCompare(second.date) || first.createdAt - second.createdAt;
    if (first.date) return -1;
    if (second.date) return 1;
    return first.createdAt - second.createdAt;
  });
}

function formatDate(date) {
  if (!date) return "Add a date";
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "Add a date" : parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mb-12 text-center">
      <p className="mb-3 text-xs uppercase tracking-[0.35em] text-rose-400">{eyebrow}</p>
      <h2 className="font-serif text-4xl text-rose-50 md:text-5xl">{title}</h2>
      <p className="mt-4 text-rose-100/50">{description}</p>
      <div className="mx-auto mt-6 h-px w-20 bg-rose-400/60" />
    </div>
  );
}

function addMonthsClamped(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function getRelationshipDuration(startValue, today = new Date()) {
  const start = new Date(`${startValue}T00:00:00`);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (Number.isNaN(start.getTime()) || start > current) return { years: 0, months: 0, days: 0, nextDate: null, daysUntil: null };

  let years = current.getFullYear() - start.getFullYear();
  let cursor = addMonthsClamped(start, years * 12);
  if (cursor > current) {
    years -= 1;
    cursor = addMonthsClamped(start, years * 12);
  }

  let months = 0;
  while (months < 11 && addMonthsClamped(cursor, months + 1) <= current) months += 1;
  cursor = addMonthsClamped(cursor, months);
  const days = Math.floor((current - cursor) / 86400000);

  let nextDate = addMonthsClamped(start, (years + 1) * 12);
  if (nextDate <= current) nextDate = addMonthsClamped(start, (years + 2) * 12);
  const daysUntil = Math.ceil((nextDate - current) / 86400000);
  return { years, months, days, nextDate, daysUntil };
}

function CounterUnit({ value, label }) {
  return (
    <motion.div key={value} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 text-center">
      <span className="block font-serif text-3xl tabular-nums text-rose-100 sm:text-4xl">{value}</span>
      <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-rose-100/45">{label}</span>
    </motion.div>
  );
}

function RelationshipCounter({ startDate, onChange, error }) {
  const duration = startDate ? getRelationshipDuration(startDate) : null;
  const isFutureDate = startDate && new Date(`${startDate}T00:00:00`) > new Date(`${todayLocal()}T00:00:00`);

  return (
    <div className="mb-16 rounded-2xl border border-rose-300/15 bg-gradient-to-br from-[#4a1b2b] to-[#260c16] p-6 shadow-xl shadow-rose-950/20 sm:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-sm">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-rose-300"><Heart size={14} className="fill-rose-300" /> Since our beginning</p>
          <h3 className="mt-2 font-serif text-2xl text-rose-50">Every day, a little more us</h3>
          <label className="mt-4 block text-xs text-rose-100/55">
            Our relationship began
            <input
              aria-label="Relationship starting date"
              type="date"
              value={startDate}
              max={todayLocal()}
              onChange={(event) => onChange(event.target.value)}
              className="mt-2 block w-full rounded-md border border-rose-200/15 bg-[#1e0911] px-3 py-2.5 text-sm text-rose-50 outline-none transition focus:border-rose-300/60 [color-scheme:dark]"
            />
          </label>
        </div>

        {duration && !isFutureDate ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-5 sm:gap-8 md:justify-end">
            <CounterUnit value={duration.years} label="Years" />
            <CounterUnit value={duration.months} label="Months" />
            <CounterUnit value={duration.days} label="Days" />
          </div>
        ) : (
          <div className="max-w-sm text-sm leading-6 text-rose-100/55 md:text-right">
            {isFutureDate ? "Choose a date that has already happened to start your counter." : "Choose your starting date to count the days in your story."}
          </div>
        )}
      </div>

      {duration?.nextDate && !isFutureDate && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-rose-100/10 pt-5 text-sm text-rose-100/65 md:justify-end">
          <Sparkles size={15} className="text-rose-300" />
          <span>Next anniversary</span>
          <strong className="font-medium text-rose-100">{formatDate(dateValueLocal(duration.nextDate))}</strong>
          <span className="text-rose-300">in {duration.daysUntil} {duration.daysUntil === 1 ? "day" : "days"}</span>
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-rose-200">{error}</p>}
    </div>
  );
}

function EventForm({ event, onClose, onSave, saving }) {
  const [title, setTitle] = useState(event?.title || "");
  const [date, setDate] = useState(event?.date || "");
  const [description, setDescription] = useState(event?.description || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileRef = useRef(null);

  const submit = async (formEvent) => {
    formEvent.preventDefault();
    await onSave({
      title: title.trim(),
      date,
      description: description.trim(),
      photoBlob: photoFile || (removePhoto ? null : event?.photoBlob || null),
      removePhoto,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#12060b]/85 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(eventMouse) => { if (eventMouse.target === eventMouse.currentTarget) onClose(); }}>
      <motion.form
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onSubmit={submit}
        className="my-auto w-full max-w-xl rounded-2xl border border-rose-200/15 bg-[#2b101b] p-5 shadow-2xl shadow-black/50 sm:p-7"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-rose-300/70">Our journey</p>
            <h3 className="mt-1 font-serif text-2xl text-rose-50">{event ? "Edit this memory" : "Add a memory"}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close event form" className="rounded-full p-2 text-rose-100/60 transition hover:bg-rose-100/10 hover:text-rose-50"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <label className="block text-xs text-rose-100/65">Event title
            <input required maxLength={100} value={title} onChange={(inputEvent) => setTitle(inputEvent.target.value)} className="mt-1.5 w-full rounded-md border border-rose-200/15 bg-[#1e0911] px-3 py-2.5 text-sm text-rose-50 outline-none focus:border-rose-300/60" />
          </label>
          <label className="block text-xs text-rose-100/65">Event date
            <input required type="date" value={date} max={todayLocal()} onChange={(inputEvent) => setDate(inputEvent.target.value)} className="mt-1.5 w-full rounded-md border border-rose-200/15 bg-[#1e0911] px-3 py-2.5 text-sm text-rose-50 outline-none focus:border-rose-300/60 [color-scheme:dark]" />
          </label>
          <label className="block text-xs text-rose-100/65">Description
            <textarea required maxLength={1000} rows={4} value={description} onChange={(inputEvent) => setDescription(inputEvent.target.value)} className="mt-1.5 w-full resize-y rounded-md border border-rose-200/15 bg-[#1e0911] px-3 py-2.5 text-sm leading-6 text-rose-50 outline-none focus:border-rose-300/60" />
          </label>
          <div>
            <span className="block text-xs text-rose-100/65">Photo</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-md border border-rose-200/15 px-3 py-2 text-xs text-rose-100/75 hover:bg-rose-100/5"><Camera size={14} /> {photoFile?.name || ((event?.photoBlob || event?.photoPath) && !removePhoto ? "Replace photo" : "Choose photo")}</button>
              {((event?.photoBlob || event?.photoPath) && !removePhoto || photoFile) && <button type="button" onClick={() => { setPhotoFile(null); setRemovePhoto(true); if (fileRef.current) fileRef.current.value = ""; }} className="text-xs text-rose-200/65 underline decoration-rose-200/30 underline-offset-2">Remove photo</button>}
            </div>
            <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(inputEvent) => { setPhotoFile(inputEvent.target.files?.[0] || null); setRemovePhoto(false); }} />
          </div>
        </div>
        <div className="mt-7 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-rose-200/15 px-4 py-2.5 text-sm text-rose-100/70 hover:bg-rose-100/5">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-md bg-rose-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-400 disabled:opacity-60">{saving ? "Saving..." : event ? "Save changes" : "Add event"}</button>
        </div>
      </motion.form>
    </div>,
    document.body,
  );
}

export function RelationshipTimeline({ supabase, coupleId, user }) {
  const [events, setEvents] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [editingEvent, setEditingEvent] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const objectUrlsRef = useRef(new Set());

  const createPhotoUrl = (blob) => {
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  };

  const revokePhotoUrl = (url) => {
    if (url && objectUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let cancelled = false;
    if (supabase && coupleId) {
      setLoading(true);
      const loadCloud = async () => {
        try {
          const [cloudEvents, cloudStartDate] = await Promise.all([
            fetchCloudTimeline(supabase, coupleId),
            fetchCloudRelationshipDate(supabase, coupleId),
          ]);
          if (!cancelled) {
            setEvents(sortEvents(cloudEvents));
            setStartDate(cloudStartDate);
            setError("");
          }
        } catch (loadError) {
          if (!cancelled) setError(loadError.message || "Could not load shared relationship memories.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      loadCloud();
      const timelineChannel = subscribeToCoupleTable(supabase, "timeline_events", coupleId, loadCloud);
      const settingsChannel = subscribeToCoupleTable(supabase, "relationship_settings", coupleId, loadCloud);
      return () => {
        cancelled = true;
        removeCloudSubscription(supabase, timelineChannel);
        removeCloudSubscription(supabase, settingsChannel);
      };
    }

    const load = async () => {
      try {
        let storedEvents = await getAllRecords(TIMELINE_STORE);
        const seeded = await getSetting(EVENT_SEED_SETTING);
        if (!seeded) {
          if (!storedEvents.length) {
            for (const sample of SAMPLE_EVENTS) await putRecord(TIMELINE_STORE, sample);
            storedEvents = SAMPLE_EVENTS;
          }
          await setSetting(EVENT_SEED_SETTING, true);
        }
        const [savedStartDate, refreshedEvents] = await Promise.all([
          getSetting("relationship-start-date"),
          storedEvents.length ? Promise.resolve(storedEvents) : getAllRecords(TIMELINE_STORE),
        ]);
        const eventViews = sortEvents(refreshedEvents).map((event) => ({ ...event, photoUrl: createPhotoUrl(event.photoBlob) }));
        if (cancelled) {
          eventViews.forEach((event) => revokePhotoUrl(event.photoUrl));
          return;
        }
        setEvents(eventViews);
        setStartDate(savedStartDate || "");
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Could not load your relationship memories.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, [supabase, coupleId]);

  const handleStartDateChange = async (value) => {
    setStartDate(value);
    setError("");
    try {
      if (supabase) await saveCloudRelationshipDate(supabase, { coupleId, userId: user.id, date: value });
      else await setSetting("relationship-start-date", value);
    } catch (saveError) {
      setError(saveError.message || "The relationship date could not be saved.");
    }
  };

  const saveEvent = async (draft) => {
    setSaving(true);
    setError("");
    const previousEvent = events.find((event) => event.id === editingEvent?.id);
    const savedEvent = {
      id: previousEvent?.id || makeId("event"),
      title: draft.title,
      date: draft.date,
      description: draft.description,
      photoBlob: draft.photoBlob,
      createdAt: previousEvent?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    try {
      let eventView;
      if (supabase) {
        eventView = await saveCloudTimelineEvent(supabase, { coupleId, userId: user.id, event: previousEvent, draft });
      } else {
        await putRecord(TIMELINE_STORE, savedEvent);
        if (previousEvent?.photoUrl && previousEvent.photoBlob !== draft.photoBlob) revokePhotoUrl(previousEvent.photoUrl);
        eventView = { ...savedEvent, photoUrl: createPhotoUrl(savedEvent.photoBlob) };
      }
      setEvents((current) => sortEvents([...current.filter((event) => event.id !== eventView.id), eventView]));
      setFormOpen(false);
      setEditingEvent(null);
    } catch (saveError) {
      setError(saveError.message || "This memory could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (event) => {
    try {
      if (supabase) await deleteCloudTimelineEvent(supabase, coupleId, event);
      else {
        await deleteRecord(TIMELINE_STORE, event.id);
        revokePhotoUrl(event.photoUrl);
      }
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setError("");
    } catch (deleteError) {
      setError(deleteError.message || "This memory could not be deleted.");
    }
  };

  const openNewEventForm = () => {
    setEditingEvent(null);
    setFormOpen(true);
  };

  const openEditEventForm = (event) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  return (
    <section id="journey" className="scroll-mt-20 bg-[#2d101b] px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <SectionHeading eyebrow="Chapter by chapter" title="Our Journey" description="A beautiful story with countless moments still to come." />
        <RelationshipCounter startDate={startDate} onChange={handleStartDateChange} error={error} />

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-rose-300/70">The moments that made us</p>
            <h3 className="mt-1 font-serif text-2xl text-rose-50">Our timeline</h3>
          </div>
          <button type="button" onClick={openNewEventForm} className="inline-flex items-center gap-2 rounded-md bg-rose-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-400"><Plus size={16} /> Add event</button>
        </div>

        {error && <p role="alert" className="mb-5 rounded-lg border border-rose-300/25 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">{error}</p>}
        {loading ? (
          <div className="rounded-xl border border-rose-200/10 bg-[#260c16]/50 p-8 text-center text-sm text-rose-100/50">Gathering your memories...</div>
        ) : events.length ? (
          <div className="relative ml-3 space-y-8 border-l border-rose-300/30 pb-2 sm:ml-6 sm:space-y-10">
            <AnimatePresence initial={false}>
              {events.map((event, index) => (
                <motion.article
                  key={event.id}
                  initial={{ opacity: 0, x: 22 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.2) }}
                  className="relative ml-6 rounded-xl border border-rose-200/10 bg-[#260c16]/70 p-4 shadow-lg shadow-rose-950/10 sm:ml-9 sm:p-6"
                >
                  <span className="absolute -left-[38px] top-6 flex h-5 w-5 items-center justify-center rounded-full border-4 border-[#2d101b] bg-rose-400 shadow-[0_0_16px_#e879a066] sm:-left-[51px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-50" />
                  </span>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-rose-300"><CalendarDays size={13} /> {formatDate(event.date)}</p>
                      <h4 className="mt-2 font-serif text-xl text-rose-50 sm:text-2xl">{event.title}</h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-rose-100/60">{event.description}</p>
                    </div>
                    {event.photoUrl && (
                      <div className="w-full shrink-0 overflow-hidden rounded-lg border border-rose-200/15 bg-[#19070d] sm:w-44">
                        <img src={event.photoUrl} alt={`Photo for ${event.title}`} className="aspect-[4/3] w-full object-cover" />
                        <p className="px-2 py-1.5 text-center font-serif text-[11px] text-rose-100/60">A moment, kept close</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex justify-end gap-2 border-t border-rose-100/10 pt-3">
                    <button type="button" onClick={() => openEditEventForm(event)} className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-rose-100/60 transition hover:bg-rose-100/5 hover:text-rose-100"><Pencil size={13} /> Edit</button>
                    <button type="button" onClick={() => deleteEvent(event)} aria-label={`Delete ${event.title}`} className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-rose-100/45 transition hover:bg-rose-400/10 hover:text-rose-200"><Trash2 size={13} /> Delete</button>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-rose-200/20 bg-[#260c16]/40 px-6 py-12 text-center">
            <Heart className="mx-auto text-rose-300/55" size={27} />
            <p className="mt-4 font-serif text-xl text-rose-50">A new chapter begins here</p>
            <p className="mt-2 text-sm text-rose-100/45">Add a moment to start your timeline.</p>
          </div>
        )}
      </div>
      <AnimatePresence>
        {formOpen && <EventForm key={editingEvent?.id || "new-event"} event={editingEvent} onClose={() => { setFormOpen(false); setEditingEvent(null); }} onSave={saveEvent} saving={saving} />}
      </AnimatePresence>
    </section>
  );
}

function LetterForm({ letter, onClose, onSave, saving }) {
  const [title, setTitle] = useState(letter?.title || "");
  const [content, setContent] = useState(letter?.content || "");
  const [date, setDate] = useState(letter?.date || todayLocal());

  const submit = async (event) => {
    event.preventDefault();
    await onSave({ title: title.trim(), content: content.trim(), date });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#12060b]/85 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.form initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onSubmit={submit} className="my-auto w-full max-w-2xl rounded-2xl border border-rose-200/15 bg-[#2b101b] p-5 shadow-2xl shadow-black/50 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-rose-300/70">Words from the heart</p>
            <h3 className="mt-1 font-serif text-2xl text-rose-50">{letter ? "Edit your letter" : "Write a love letter"}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close letter form" className="rounded-full p-2 text-rose-100/60 transition hover:bg-rose-100/10 hover:text-rose-50"><X size={18} /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block text-xs text-rose-100/65">Letter title
            <input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-md border border-rose-200/15 bg-[#1e0911] px-3 py-2.5 text-sm text-rose-50 outline-none focus:border-rose-300/60" />
          </label>
          <label className="block text-xs text-rose-100/65">Creation date
            <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 w-full rounded-md border border-rose-200/15 bg-[#1e0911] px-3 py-2.5 text-sm text-rose-50 outline-none focus:border-rose-300/60 [color-scheme:dark]" />
          </label>
        </div>
        <label className="mt-4 block text-xs text-rose-100/65">Your letter
          <textarea required maxLength={10000} rows={10} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write what you want to remember..." className="mt-1.5 w-full resize-y rounded-md border border-rose-200/15 bg-[#1e0911] px-3 py-3 text-sm leading-7 text-rose-50 outline-none placeholder:text-rose-100/25 focus:border-rose-300/60" />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-rose-200/15 px-4 py-2.5 text-sm text-rose-100/70 hover:bg-rose-100/5">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-rose-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-400 disabled:opacity-60">{saving ? "Saving..." : <><Mail size={15} /> Save letter</>}</button>
        </div>
      </motion.form>
    </div>,
    document.body,
  );
}

function LetterReader({ letter, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#13070c]/95 p-4 backdrop-blur-md sm:p-8" role="dialog" aria-modal="true" aria-labelledby="open-letter-title">
      <button type="button" onClick={onClose} aria-label="Close letter" className="fixed right-4 top-4 z-20 rounded-full border border-rose-100/20 bg-[#2a0e18]/80 p-2.5 text-rose-100/80 transition hover:bg-rose-300/15 hover:text-white sm:right-8 sm:top-8"><X size={19} /></button>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[12, 31, 69, 88].map((left, index) => (
          <motion.span key={left} className="absolute bottom-[-20px] text-rose-300/35" style={{ left: `${left}%` }} animate={{ y: [0, -window.innerHeight], opacity: [0, 0.8, 0], rotate: [0, index % 2 ? 24 : -24] }} transition={{ duration: 8 + index * 1.5, delay: index * 0.8, ease: "linear", repeat: Infinity }}>
            {index % 2 ? <Flower2 size={18} /> : <Heart size={16} fill="currentColor" />}
          </motion.span>
        ))}
      </div>
      <motion.article initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, delay: 0.12 }} className="relative my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-rose-200/20 bg-gradient-to-br from-[#f7e9e3] to-[#ead4d0] p-6 text-[#542638] shadow-[0_25px_100px_#0009] sm:p-12">
        <motion.div initial={{ rotateX: 0 }} animate={{ rotateX: -180 }} transition={{ duration: 0.85, ease: [0.2, 0.7, 0.2, 1] }} style={{ transformOrigin: "top center", transformStyle: "preserve-3d" }} className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-[#d7aaa9] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.65 }} className="relative z-0">
          <div className="mb-8 flex items-center justify-center gap-3 text-rose-700/70"><span className="h-px w-10 bg-rose-700/30" /><Heart size={17} className="fill-current" /><span className="h-px w-10 bg-rose-700/30" /></div>
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-rose-800/55">A letter, kept close</p>
          <h2 id="open-letter-title" className="mt-3 text-center font-serif text-3xl italic text-[#542638] sm:text-4xl">{letter.title}</h2>
          <p className="mt-3 text-center text-xs uppercase tracking-[0.18em] text-rose-800/55">{formatDate(letter.date)}</p>
          <div className="mx-auto my-7 h-px max-w-xs bg-rose-800/20" />
          <p className="whitespace-pre-wrap font-serif text-base leading-8 text-[#603346] sm:text-lg sm:leading-9">{letter.content}</p>
          <div className="mt-9 flex items-center justify-center gap-2 font-serif text-lg italic text-rose-700"><Heart size={16} className="fill-current" /> With all my love <Flower2 size={17} /></div>
        </motion.div>
      </motion.article>
    </motion.div>,
    document.body,
  );
}

export function LoveLetters({ supabase, coupleId, user }) {
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLetter, setEditingLetter] = useState(null);
  const [openLetter, setOpenLetter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (supabase && coupleId) {
        const cloudLetters = await fetchCloudLetters(supabase, coupleId);
        if (!cancelled) setLetters(cloudLetters);
        return;
      }
      let records = await getAllRecords(LETTER_STORE);
      const seeded = await getSetting(LETTER_SEED_SETTING);
      if (!seeded) {
        if (!records.length) {
          await putRecord(LETTER_STORE, STARTER_LETTER);
          records = [STARTER_LETTER];
        }
        await setSetting(LETTER_SEED_SETTING, true);
      }
      if (!cancelled) setLetters([...records].sort((first, second) => second.createdAt - first.createdAt));
    };
    const load = () => refresh()
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Could not load your letters.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    load();
    const channel = supabase && coupleId ? subscribeToCoupleTable(supabase, "love_letters", coupleId, load) : null;
    return () => {
      cancelled = true;
      removeCloudSubscription(supabase, channel);
    };
  }, [supabase, coupleId]);

  const saveLetter = async (draft) => {
    setSaving(true);
    setError("");
    const record = {
      id: editingLetter?.id || makeId("letter"),
      title: draft.title,
      content: draft.content,
      date: draft.date,
      createdAt: editingLetter?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    try {
      const savedLetter = supabase
        ? await saveCloudLetter(supabase, { coupleId, userId: user.id, letter: editingLetter, draft })
        : await putRecord(LETTER_STORE, record).then(() => record);
      setLetters((current) => [savedLetter, ...current.filter((letter) => letter.id !== savedLetter.id)].sort((first, second) => second.createdAt - first.createdAt));
      setFormOpen(false);
      setEditingLetter(null);
    } catch (saveError) {
      setError(saveError.message || "This letter could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteLetter = async (letter) => {
    try {
      if (supabase) await deleteCloudLetter(supabase, coupleId, letter);
      else await deleteRecord(LETTER_STORE, letter.id);
      setLetters((current) => current.filter((item) => item.id !== letter.id));
      if (openLetter?.id === letter.id) setOpenLetter(null);
      setError("");
    } catch (deleteError) {
      setError(deleteError.message || "This letter could not be deleted.");
    }
  };

  return (
    <section id="letters" className="scroll-mt-20 px-6 py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Words from my heart" title="Love Letters" description="Some feelings deserve their own special place." />
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-rose-200/10 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-300/70">Written just for us</p>
            <h3 className="mt-1 font-serif text-2xl text-rose-50">Our letters <span className="font-sans text-sm text-rose-100/40">{letters.length}</span></h3>
          </div>
          <button type="button" onClick={() => { setEditingLetter(null); setFormOpen(true); }} className="inline-flex items-center gap-2 rounded-md bg-rose-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-400"><Plus size={16} /> Write a letter</button>
        </div>

        {error && <p role="alert" className="mb-5 rounded-lg border border-rose-300/25 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">{error}</p>}
        {loading ? (
          <div className="rounded-xl border border-rose-200/10 bg-[#260c16]/40 p-8 text-center text-sm text-rose-100/50">Opening your keepsake box...</div>
        ) : letters.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {letters.map((letter) => (
                <motion.article key={letter.id} layout initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} whileHover={{ y: -3 }} className="overflow-hidden rounded-xl border border-rose-200/15 bg-gradient-to-br from-[#401827] to-[#260c16] shadow-lg shadow-rose-950/15">
                  <button type="button" onClick={() => setOpenLetter(letter)} className="block w-full p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300 sm:p-6">
                    <motion.div initial="closed" whileHover="open" className="relative mb-5 flex h-28 items-center justify-center overflow-hidden rounded-lg border border-rose-100/10 bg-[#1d0911]">
                      <motion.div variants={{ closed: { y: 0 }, open: { y: -7 } }} transition={{ duration: 0.25 }} className="absolute bottom-3 h-16 w-24 rounded-sm border border-rose-200/30 bg-[#f3e2d5] shadow-lg" />
                      <Mail className="relative z-10 text-rose-300" size={30} />
                      <Heart className="absolute right-5 top-4 h-4 w-4 fill-rose-400/70 text-rose-300" />
                    </motion.div>
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-rose-300/65"><CalendarDays size={12} /> {formatDate(letter.date)}</p>
                    <h4 className="mt-2 truncate font-serif text-xl text-rose-50">{letter.title}</h4>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-rose-100/55">{letter.content}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-xs text-rose-200">Open letter <BookOpen size={13} /></span>
                  </button>
                  <div className="flex justify-end gap-1 border-t border-rose-100/10 px-4 py-2">
                    <button type="button" onClick={() => { setEditingLetter(letter); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-rose-100/55 hover:bg-rose-100/5 hover:text-rose-100"><Pencil size={13} /> Edit</button>
                    <button type="button" onClick={() => deleteLetter(letter)} aria-label={`Delete ${letter.title}`} className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-rose-100/45 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 size={13} /> Delete</button>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-rose-200/20 bg-[#260c16]/40 px-6 py-12 text-center">
            <Mail className="mx-auto text-rose-300/55" size={28} />
            <p className="mt-4 font-serif text-xl text-rose-50">A little note can hold a lot</p>
            <p className="mt-2 text-sm text-rose-100/45">Write your first letter and keep it close for later.</p>
            <button type="button" onClick={() => { setEditingLetter(null); setFormOpen(true); }} className="mt-5 inline-flex items-center gap-2 rounded-md border border-rose-300/30 px-4 py-2.5 text-sm text-rose-100 transition hover:bg-rose-300/10"><Plus size={15} /> Write a letter</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {formOpen && <LetterForm key={editingLetter?.id || "new-letter"} letter={editingLetter} onClose={() => { setFormOpen(false); setEditingLetter(null); }} onSave={saveLetter} saving={saving} />}
        {openLetter && <LetterReader key={openLetter.id} letter={openLetter} onClose={() => setOpenLetter(null)} />}
      </AnimatePresence>
    </section>
  );
}