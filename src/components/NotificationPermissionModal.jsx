import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, X, ChevronRight, Shield, Smartphone, Share } from "lucide-react";

const backdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modal = {
  hidden: { opacity: 0, scale: 0.9, y: 40 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", damping: 25, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 },
  },
};

const bellRing = {
  initial: { rotate: 0 },
  animate: {
    rotate: [0, 15, -15, 12, -12, 8, -8, 0],
    transition: { duration: 1.2, repeat: Infinity, repeatDelay: 2 },
  },
};

function BellIcon() {
  return (
    <motion.div
      className="relative w-20 h-20 mx-auto mb-6"
      variants={bellRing}
      initial="initial"
      animate="animate"
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 opacity-20 blur-xl" />
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 opacity-30 blur-lg" />
      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
        <Bell size={36} className="text-white drop-shadow-lg" strokeWidth={2.5} />
      </div>
    </motion.div>
  );
}

function DeniedIcon() {
  return (
    <motion.div
      className="relative w-20 h-20 mx-auto mb-6"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-400 to-red-500 opacity-20 blur-xl" />
      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
        <BellOff size={36} className="text-white drop-shadow-lg" strokeWidth={2.5} />
      </div>
    </motion.div>
  );
}

function GlowEffect() {
  return (
    <>
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
    </>
  );
}

export function NotificationPermissionModal({ visible, onEnable, onNotNow, processing }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onNotNow} />

          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(8,20,40,0.98) 100%)",
            }}
            variants={modal}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <GlowEffect />

            <button
              onClick={onNotNow}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="relative p-8 text-center">
              <BellIcon />

              <h2 className="text-2xl font-bold text-white mb-3">
                Stay in the Loop
              </h2>

              <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
                Get instant notifications for new events, announcements, and important updates from MT Club.
              </p>

              <div className="space-y-3">
                <motion.button
                  onClick={onEnable}
                  disabled={processing}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full py-4 rounded-2xl font-semibold text-white text-base overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed group"
                  style={{
                    background: "linear-gradient(135deg, #06b6d4, #2563eb)",
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center justify-center gap-2">
                    {processing ? (
                      <motion.div
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <Bell size={18} />
                    )}
                    {processing ? "Enabling..." : "Enable Notifications"}
                  </span>
                </motion.button>

                <button
                  onClick={onNotNow}
                  disabled={processing}
                  className="w-full py-3 rounded-2xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition text-sm disabled:opacity-40"
                >
                  Not Now
                </button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                <Shield size={12} />
                <span>We respect your privacy. No spam.</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NotificationDeniedModal({ visible, onClose, onOpenSettings, browser }) {
  const instructions = {
    chrome: "Click the lock icon in the address bar > Site Settings > Notifications > Allow",
    edge: "Click the lock icon in the address bar > Permissions > Notifications > Allow",
    firefox: "Click the lock icon > Permissions > Notifications > Allow",
    safari: "Go to Safari > Settings > Websites > Notifications > Find this site > Allow",
    other: "Open your browser settings, find Notifications, and allow notifications for this site.",
  };

  const instructionText = instructions[browser] || instructions.other;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,15,10,0.98) 100%)",
            }}
            variants={modal}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <GlowEffect />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="relative p-8 text-center">
              <DeniedIcon />

              <h2 className="text-2xl font-bold text-white mb-3">
                Notifications Blocked
              </h2>

              <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
                Browser notifications are currently blocked for this site. You can enable them from your browser settings.
              </p>

              <div className="bg-white/5 rounded-2xl p-4 mb-8 border border-white/5">
                <p className="text-xs text-gray-400 leading-relaxed text-left">
                  {instructionText}
                </p>
              </div>

              <div className="space-y-3">
                <motion.button
                  onClick={onOpenSettings}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full py-4 rounded-2xl font-semibold text-white text-base overflow-hidden group"
                  style={{
                    background: "linear-gradient(135deg, #f97316, #ef4444)",
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center justify-center gap-2">
                    <ChevronRight size={18} />
                    How to Enable
                  </span>
                </motion.button>

                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NotificationIOSModal({ visible, onClose }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(8,20,40,0.98) 100%)",
            }}
            variants={modal}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <GlowEffect />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="relative p-8 text-center">
              <motion.div
                className="relative w-20 h-20 mx-auto mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 opacity-20 blur-xl" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <Smartphone size={36} className="text-white drop-shadow-lg" strokeWidth={2.5} />
                </div>
              </motion.div>

              <h2 className="text-2xl font-bold text-white mb-3">
                Add to Home Screen
              </h2>

              <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
                On iPhone, notifications only work when MT Club is added to your Home Screen.
              </p>

              <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/5 text-left space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Tap the <strong className="text-white">Share</strong> button <Share size={12} className="inline" /> in Safari's bottom bar
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Open MT Club from your Home Screen — notifications will work automatically
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition text-sm"
                >
                  Got it
                </button>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                <Shield size={12} />
                <span>Required by iPhone for web notifications</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
