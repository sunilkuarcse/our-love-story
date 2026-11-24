import { getAllRecords, getSetting } from "./relationship-storage.js";

export const PRIVATE_IMAGE_BUCKET = "couple-memories";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SIGNED_URL_SECONDS = 24 * 60 * 60;

function assertImage(blob, name = "image") {
  if (!(blob instanceof Blob) || !IMAGE_TYPES.has(blob.type)) {
    throw new Error(`${name} must be a JPG, PNG, or WEBP image.`);
  }
  if (blob.size > MAX_IMAGE_BYTES) throw new Error(`${name} must be 10 MB or smaller.`);
}

async function sha256(blob) {
  if (!window.crypto?.subtle) throw new Error("Secure image hashing is unavailable in this browser.");
  const digest = await window.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function extensionFor(blob) {
  if (blob.type === "image/jpeg") return "jpg";
  if (blob.type === "image/webp") return "webp";
  return "png";
}

async function uploadPrivateImage(supabase, coupleId, folder, blob, name) {
  assertImage(blob, name);
  const hash = await sha256(blob);
  const storagePath = `${coupleId}/${folder}/${hash}.${extensionFor(blob)}`;
  const { error } = await supabase.storage.from(PRIVATE_IMAGE_BUCKET).upload(storagePath, blob, {
    cacheControl: "3600",
    contentType: blob.type,
    upsert: true,
  });
  if (error) throw error;
  return { hash, storagePath };
}

export async function createSignedImageUrl(supabase, storagePath) {
  if (!storagePath) return "";
  const { data, error } = await supabase.storage.from(PRIVATE_IMAGE_BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

function mapCloudPhoto(record, src) {
  return {
    id: record.id,
    title: record.title || "",
    caption: record.caption || "",
    date: record.photo_date || "",
    frame: record.frame_id || "polaroid",
    zoom: Number(record.zoom || 1),
    positionX: record.position_x || 0,
    positionY: record.position_y || 0,
    rotation: record.rotation || 0,
    animationEffects: record.animation_effects || undefined,
    animationSpeed: Number(record.animation_speed || 1),
    storagePath: record.storage_path,
    contentHash: record.content_hash,
    cloud: true,
    src,
  };
}

export async function fetchCloudPhotos(supabase, coupleId) {
  const { data, error } = await supabase.from("photos").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all(data.map(async (record) => mapCloudPhoto(record, await createSignedImageUrl(supabase, record.storage_path))));
}

export async function createCloudPhoto(supabase, { coupleId, userId, file, photo, localId = null }) {
  assertImage(file, "Photo");
  const hash = await sha256(file);
  let existingQuery = supabase.from("photos").select("*").eq("couple_id", coupleId);
  existingQuery = localId !== null ? existingQuery.eq("local_id", String(localId)) : existingQuery.eq("content_hash", hash);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw existingError;
  if (existing) return mapCloudPhoto(existing, await createSignedImageUrl(supabase, existing.storage_path));

  const { storagePath } = await uploadPrivateImage(supabase, coupleId, "photos", file, "Photo");
  const row = {
    couple_id: coupleId,
    owner_id: userId,
    local_id: localId === null ? null : String(localId),
    content_hash: hash,
    storage_path: storagePath,
    title: photo.title || "",
    caption: photo.caption || "",
    photo_date: photo.date || null,
    frame_id: photo.frame || "polaroid",
    zoom: photo.zoom || 1,
    position_x: photo.positionX || 0,
    position_y: photo.positionY || 0,
    rotation: photo.rotation || 0,
    animation_effects: photo.animationEffects || {},
    animation_speed: photo.animationSpeed || 1,
  };
  const { data: created, error: insertError } = await supabase.from("photos").insert(row).select("*").single();
  if (insertError?.code === "23505") {
    const { data: duplicate, error: duplicateError } = await supabase.from("photos").select("*").eq("couple_id", coupleId).eq("content_hash", hash).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return mapCloudPhoto(duplicate, await createSignedImageUrl(supabase, duplicate.storage_path));
  }
  if (insertError) throw insertError;
  return mapCloudPhoto(created, await createSignedImageUrl(supabase, created.storage_path));
}

export async function updateCloudPhoto(supabase, coupleId, photo) {
  const { data, error } = await supabase.from("photos").update({
    title: photo.title || "",
    caption: photo.caption || "",
    photo_date: photo.date || null,
    frame_id: photo.frame || "polaroid",
    zoom: photo.zoom,
    position_x: photo.positionX,
    position_y: photo.positionY,
    rotation: photo.rotation,
    animation_effects: photo.animationEffects || {},
    animation_speed: photo.animationSpeed || 1,
  }).eq("id", photo.id).eq("couple_id", coupleId).select("*").single();
  if (error) throw error;
  return mapCloudPhoto(data, photo.src);
}

export async function deleteCloudPhoto(supabase, coupleId, photo) {
  const { error } = await supabase.from("photos").delete().eq("id", photo.id).eq("couple_id", coupleId);
  if (error) throw error;
  const { error: storageError } = await supabase.storage.from(PRIVATE_IMAGE_BUCKET).remove([photo.storagePath]);
  if (storageError) throw storageError;
}

export async function fetchCloudTimeline(supabase, coupleId) {
  const { data, error } = await supabase.from("timeline_events").select("*").eq("couple_id", coupleId).order("event_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });
  if (error) throw error;
  return Promise.all(data.map(async (event) => ({
    id: event.id,
    localId: event.local_id,
    title: event.title,
    date: event.event_date || "",
    description: event.description || "",
    photoPath: event.photo_path,
    photoUrl: await createSignedImageUrl(supabase, event.photo_path),
    createdAt: new Date(event.created_at).getTime(),
    cloud: true,
  })));
}

export async function saveCloudTimelineEvent(supabase, { coupleId, userId, event, draft }) {
  const id = event?.id || window.crypto.randomUUID();
  let photoPath = draft.removePhoto ? null : event?.photoPath || null;
  if (draft.photoBlob) {
    const uploaded = await uploadPrivateImage(supabase, coupleId, `timeline/${id}`, draft.photoBlob, "Event photo");
    photoPath = uploaded.storagePath;
  }
  const record = {
    id,
    couple_id: coupleId,
    owner_id: event?.ownerId || userId,
    local_id: event?.localId || null,
    title: draft.title,
    event_date: draft.date || null,
    description: draft.description,
    photo_path: photoPath,
  };
  const query = event?.cloud
    ? supabase.from("timeline_events").update(record).eq("id", id).eq("couple_id", coupleId)
    : supabase.from("timeline_events").insert(record);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  if (event?.photoPath && event.photoPath !== photoPath) {
    await supabase.storage.from(PRIVATE_IMAGE_BUCKET).remove([event.photoPath]);
  }
  return {
    id: data.id,
    localId: data.local_id,
    ownerId: data.owner_id,
    title: data.title,
    date: data.event_date || "",
    description: data.description || "",
    photoPath: data.photo_path,
    photoUrl: await createSignedImageUrl(supabase, data.photo_path),
    createdAt: new Date(data.created_at).getTime(),
    cloud: true,
  };
}

export async function deleteCloudTimelineEvent(supabase, coupleId, event) {
  const { error } = await supabase.from("timeline_events").delete().eq("id", event.id).eq("couple_id", coupleId);
  if (error) throw error;
  if (event.photoPath) {
    const { error: storageError } = await supabase.storage.from(PRIVATE_IMAGE_BUCKET).remove([event.photoPath]);
    if (storageError) throw storageError;
  }
}

export async function fetchCloudLetters(supabase, coupleId) {
  const { data, error } = await supabase.from("love_letters").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((letter) => ({
    id: letter.id,
    localId: letter.local_id,
    ownerId: letter.owner_id,
    title: letter.title,
    content: letter.content,
    date: letter.letter_date,
    createdAt: new Date(letter.created_at).getTime(),
    cloud: true,
  }));
}

export async function saveCloudLetter(supabase, { coupleId, userId, letter, draft }) {
  const id = letter?.id || window.crypto.randomUUID();
  const record = {
    id,
    couple_id: coupleId,
    owner_id: letter?.ownerId || userId,
    local_id: letter?.localId || null,
    title: draft.title,
    content: draft.content,
    letter_date: draft.date,
  };
  const query = letter?.cloud
    ? supabase.from("love_letters").update(record).eq("id", id).eq("couple_id", coupleId)
    : supabase.from("love_letters").insert(record);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return {
    id: data.id,
    localId: data.local_id,
    ownerId: data.owner_id,
    title: data.title,
    content: data.content,
    date: data.letter_date,
    createdAt: new Date(data.created_at).getTime(),
    cloud: true,
  };
}

export async function deleteCloudLetter(supabase, coupleId, letter) {
  const { error } = await supabase.from("love_letters").delete().eq("id", letter.id).eq("couple_id", coupleId);
  if (error) throw error;
}

export async function fetchCloudRelationshipDate(supabase, coupleId) {
  const { data, error } = await supabase.from("relationship_settings").select("relationship_start_date").eq("couple_id", coupleId).maybeSingle();
  if (error) throw error;
  return data?.relationship_start_date || "";
}

export async function saveCloudRelationshipDate(supabase, { coupleId, userId, date }) {
  const { error } = await supabase.from("relationship_settings").upsert({
    couple_id: coupleId,
    owner_id: userId,
    relationship_start_date: date || null,
  }, { onConflict: "couple_id" });
  if (error) throw error;
}

async function findMigratedRecord(supabase, table, coupleId, localId) {
  const { data, error } = await supabase.from(table).select("id").eq("couple_id", coupleId).eq("local_id", String(localId)).maybeSingle();
  if (error) throw error;
  return data;
}

export async function migrateLocalMemories(supabase, { coupleId, userId, onProgress = () => {} }) {
  const [photos, events, letters, relationshipDate] = await Promise.all([
    getAllRecords("photos"),
    getAllRecords("timelineEvents"),
    getAllRecords("loveLetters"),
    getSetting("relationship-start-date"),
  ]);
  const totals = { photos: 0, events: 0, letters: 0, skipped: 0 };
  const totalItems = photos.length + events.length + letters.length + (relationshipDate ? 1 : 0);
  let completed = 0;
  const report = () => onProgress({ ...totals, completed, totalItems });

  for (const photo of photos) {
    const existing = await findMigratedRecord(supabase, "photos", coupleId, photo.id);
    if (existing) totals.skipped += 1;
    else {
      await createCloudPhoto(supabase, {
        coupleId,
        userId,
        file: photo.blob,
        localId: photo.id,
        photo,
      });
      totals.photos += 1;
    }
    completed += 1;
    report();
  }

  for (const event of events) {
    const existing = await findMigratedRecord(supabase, "timeline_events", coupleId, event.id);
    if (existing) totals.skipped += 1;
    else {
      let photoPath = null;
      if (event.photoBlob) {
        ({ storagePath: photoPath } = await uploadPrivateImage(supabase, coupleId, `timeline/${event.id}`, event.photoBlob, "Event photo"));
      }
      const { error } = await supabase.from("timeline_events").insert({
        couple_id: coupleId,
        owner_id: userId,
        local_id: String(event.id),
        title: event.title,
        event_date: event.date || null,
        description: event.description || "",
        photo_path: photoPath,
      });
      if (error?.code === "23505") totals.skipped += 1;
      else if (error) throw error;
      else totals.events += 1;
    }
    completed += 1;
    report();
  }

  for (const letter of letters) {
    const existing = await findMigratedRecord(supabase, "love_letters", coupleId, letter.id);
    if (existing) totals.skipped += 1;
    else {
      const { error } = await supabase.from("love_letters").insert({
        couple_id: coupleId,
        owner_id: userId,
        local_id: String(letter.id),
        title: letter.title,
        content: letter.content,
        letter_date: letter.date || null,
      });
      if (error?.code === "23505") totals.skipped += 1;
      else if (error) throw error;
      else totals.letters += 1;
    }
    completed += 1;
    report();
  }

  if (relationshipDate) {
    await saveCloudRelationshipDate(supabase, { coupleId, userId, date: relationshipDate });
    completed += 1;
    report();
  }
  return totals;
}

export function subscribeToCoupleTable(supabase, table, coupleId, onChange) {
  return supabase
    .channel(`${table}-${coupleId}-${window.crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table, filter: `couple_id=eq.${coupleId}` }, onChange)
    .subscribe();
}

export function removeCloudSubscription(supabase, channel) {
  if (channel) supabase.removeChannel(channel);
}
