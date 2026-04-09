import React from 'react';

interface SettingsRowProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function SettingsRow({ title, description, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between p-5 bg-surface-container-low rounded-lg transition-all hover:bg-surface-container">
      <div>
        <p className="font-semibold text-on-surface">{title}</p>
        <p className="text-sm text-on-surface-variant">{description}</p>
      </div>
      {children}
    </div>
  );
}
