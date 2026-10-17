import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, QrCode } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCode: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  sessionCode,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const cleanPin = sessionCode.replace(/\D/g, '');
  const joinUrl = `${window.location.origin}/#join=${cleanPin}`;

  useEffect(() => {
    if (isOpen && sessionCode) {
      QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url: string) => setDataUrl(url))
        .catch((err: unknown) => console.error(err));
    }
  }, [isOpen, sessionCode, joinUrl]);

  if (!isOpen) return null;

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-center">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400">
          <QrCode className="h-6 w-6" />
        </div>

        <h3 className="text-xl font-bold text-white">Scan to Join Live Quiz</h3>
        <p className="mt-1 text-sm text-slate-400">
          Point phone camera at this QR code to jump straight into the lobby!
        </p>

        <div className="my-5 flex justify-center">
          {dataUrl ? (
            <div className="rounded-2xl bg-white p-3 shadow-inner">
              <img
                src={dataUrl}
                alt={`Join QR code for ${sessionCode}`}
                className="h-56 w-56 rounded-lg"
              />
            </div>
          ) : (
            <div className="h-56 w-56 flex items-center justify-center bg-slate-800 rounded-2xl animate-pulse text-sm text-slate-500">
              Generating QR...
            </div>
          )}
        </div>

        <div className="mb-4 rounded-2xl bg-slate-800/80 p-3 border border-slate-700">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Game PIN
          </div>
          <div className="text-3xl font-black font-mono tracking-widest text-indigo-400">
            {sessionCode}
          </div>
        </div>

        <button
          onClick={copyLink}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-98 transition-all"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-300" />
              <span>Direct Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy Direct Join Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
