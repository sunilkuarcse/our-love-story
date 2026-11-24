
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Heart, LoaderCircle, LogOut, Menu, X, ArrowDown, CloudUpload } from "lucide-react";
import PhotoGallery from "./photo-gallery.jsx";
import { LoveLetters, RelationshipTimeline } from "./relationship-sections.jsx";
import { useAuth } from "./auth.jsx";
import { migrateLocalMemories } from "./supabase-content.js";

const floatingHearts = Array.from({ length: 12 }, (_, i) => ({
  left: `${(i * 37 + 7) % 100}%`,
  delay: i * 0.8,
  duration: 7 + (i % 5),
}));

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState("");
  const { user, coupleId, supabase, signOut } = useAuth();

  const handleMigration = async () => {
    setMigrationBusy(true);
    setMigrationStatus("Preparing a copy of local memories...");
    try {
      const summary = await migrateLocalMemories(supabase, {
        coupleId,
        userId: user.id,
        onProgress: ({ completed, totalItems }) => setMigrationStatus(`Copying local memories: ${completed} of ${totalItems}`),
      });
      setMigrationStatus(`Migration complete: ${summary.photos} photos, ${summary.events} events, ${summary.letters} letters copied; ${summary.skipped} already present. Local data was kept.`);
    } catch (migrationError) {
      setMigrationStatus(migrationError.message || "Migration stopped. Your local records were not deleted; retry when ready.");
    } finally {
      setMigrationBusy(false);
    }
  };

  const navItems = [
    ["Home", "#home"],
    ["Our Memories", "#gallery"],
    ["Our Journey", "#journey"],
    ["Love Letters", "#letters"],
  ];

  return (
    <main className="min-h-screen bg-[#210b12] text-white overflow-hidden">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#210b12]/85 backdrop-blur-xl border-b border-rose-300/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <a href="#home" className="font-serif text-2xl text-rose-200">
            <Heart className="inline w-5 h-5 fill-rose-400 text-rose-400 mr-2" />
            Our Love Story
          </a>

          <div className="hidden md:flex gap-8 text-sm text-rose-100/70">
            {navItems.map(([label, link]) => (
              <a key={label} href={link} className="hover:text-rose-300 transition">
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-xs text-rose-100/45 lg:block">{user.email}</span>
            <button type="button" onClick={handleMigration} disabled={migrationBusy} className="inline-flex items-center gap-2 rounded-md border border-rose-200/15 px-2.5 py-2 text-xs text-rose-100/70 transition hover:bg-rose-300/10 hover:text-rose-50 disabled:opacity-50" aria-label="Migrate local memories">
              {migrationBusy ? <LoaderCircle className="animate-spin" size={14} /> : <CloudUpload size={15} />}
              <span className="hidden sm:inline">{migrationBusy ? "Copying..." : "Migrate local memories"}</span>
            </button>
            <button type="button" onClick={() => signOut()} className="inline-flex items-center gap-2 rounded-md border border-rose-200/15 px-2.5 py-2 text-xs text-rose-100/70 transition hover:bg-rose-300/10 hover:text-rose-50" aria-label="Sign out">
              <LogOut size={15} /><span className="hidden sm:inline">Sign out</span>
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-rose-200"
              aria-label="Toggle navigation"
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden p-6 flex flex-col gap-5 bg-[#2d101b]">
            {navItems.map(([label, link]) => (
              <a key={label} href={link} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* Hero */}
      <section
        id="home"
        className="relative min-h-screen flex items-center justify-center text-center px-6 pt-24"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#76283d_0%,_#35121e_45%,_#210b12_100%)]" />

        {floatingHearts.map((heart, i) => (
          <motion.div
            key={i}
            className="absolute text-rose-300/30 pointer-events-none"
            style={{ left: heart.left, bottom: "-30px" }}
            animate={{ y: [0, -900], opacity: [0, 0.8, 0] }}
            transition={{
              duration: heart.duration,
              delay: heart.delay,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <Heart size={12 + (i % 3) * 8} fill="currentColor" />
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2 }}
          className="relative z-10 max-w-4xl"
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="inline-block mb-8"
          >
            <Heart className="w-12 h-12 text-rose-400 fill-rose-400 mx-auto" />
          </motion.div>

          <p className="text-rose-300 uppercase tracking-[0.5em] text-xs md:text-sm mb-6">
            A little world made for two
          </p>

          <h1 className="font-serif text-6xl md:text-8xl lg:text-9xl text-rose-50 leading-tight">
            Our Love
            <br />
            <span className="italic text-rose-300">Story</span>
          </h1>

          <p className="text-rose-100/70 text-lg md:text-xl mt-8 max-w-xl mx-auto leading-relaxed">
            Every picture holds a memory. Every memory tells a story.
            And every chapter is special because it has you.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
            <a
              href="#gallery"
              className="bg-rose-500 hover:bg-rose-400 text-white px-8 py-4 rounded-full transition shadow-lg shadow-rose-900/30"
            >
              Explore Our Memories <Heart className="inline ml-2 w-4 h-4" />
            </a>
            <a
              href="#journey"
              className="border border-rose-300/40 hover:bg-rose-300/10 px-8 py-4 rounded-full transition"
            >
              Our Journey
            </a>
          </div>

          <div className="mt-20 text-rose-200/40 text-xs tracking-widest">
            SCROLL TO EXPLORE
            <ArrowDown className="mx-auto mt-3 animate-bounce" size={18} />
          </div>
        </motion.div>
      </section>

      <PhotoGallery supabase={supabase} coupleId={coupleId} user={user} />

      <RelationshipTimeline supabase={supabase} coupleId={coupleId} user={user} />

      <LoveLetters supabase={supabase} coupleId={coupleId} user={user} />

      {migrationStatus && <p role="status" className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-lg border border-rose-200/15 bg-[#2a0e18]/95 px-4 py-3 text-xs leading-5 text-rose-100 shadow-xl">{migrationStatus}</p>}

      {/* Footer */}
      <footer className="border-t border-rose-200/10 py-10 text-center bg-[#19070d]">
        <Heart className="mx-auto text-rose-400 fill-rose-400 mb-4" />
        <h3 className="font-serif text-2xl text-rose-200">Our Love Story</h3>
        <p className="text-rose-100/40 text-sm mt-3">
          Made with love, for our forever memories.
        </p>
        <p className="text-rose-100/25 text-xs mt-6">
          © {new Date().getFullYear()} Our Love Story. All rights reserved.
        </p>
      </footer>
    </main>
  );
}

export default App;
