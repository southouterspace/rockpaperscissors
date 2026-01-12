"use client";

import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";

import "./styles/retro.css";

interface ToastOptions {
  title?: string;
  description?: string;
}

export function toast(options: ToastOptions | string) {
  const { title, description } =
    typeof options === "string"
      ? { title: options, description: undefined }
      : options;
  return sonnerToast.custom((id) => (
    <Toast description={description} id={id} title={title} />
  ));
}

interface ToastProps {
  id: string | number;
  title?: string;
  description?: string;
}

function Toast({ title, description }: ToastProps) {
  return (
    <div className="relative retro">
      <div className="flex rounded-lg bg-background shadow-lg ring-1 ring-black/5 w-full md:max-w-[364px] items-center p-4">
        <div className="flex flex-1 items-center">
          <div className="w-full">
            {title && <p className="text-sm font-medium">{title}</p>}
            {description && <p className="text-sm opacity-90">{description}</p>}
          </div>
        </div>
      </div>

      <div className="absolute -top-1.5 w-1/2 left-1.5 h-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute -top-1.5 w-1/2 right-1.5 h-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute -bottom-1.5 w-1/2 left-1.5 h-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute -bottom-1.5 w-1/2 right-1.5 h-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute top-0 left-0 size-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute top-0 right-0 size-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute bottom-0 left-0 size-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute bottom-0 right-0 size-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute top-1 -left-1.5 h-1/2 w-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute bottom-1 -left-1.5 h-1/2 w-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute top-1 -right-1.5 h-1/2 w-1.5 bg-foreground dark:bg-ring" />
      <div className="absolute bottom-1 -right-1.5 h-1/2 w-1.5 bg-foreground dark:bg-ring" />
    </div>
  );
}

export function Toaster() {
  return <SonnerToaster offset={24} position="top-center" />;
}
