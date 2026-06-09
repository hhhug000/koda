import * as Lucide from 'lucide-react';

const ICON_MAP = {
  file: 'File',
  folder: 'Folder',
  'folder-open': 'Folder',
  array: 'List',
  object: 'Box',
  function: 'Code',
  class: 'Layers',
  property: 'Wrench',
  variable: 'Hash',
  jsx: 'Code'
};

export function Icon({ name, title, size = 14 }) {
  const iconKey = ICON_MAP[name] ?? name;
  const IconComp = Lucide[iconKey];

  if (IconComp) {
    return (
      <span className="koda-icon" aria-hidden={title ? 'false' : 'true'} title={title}>
        <IconComp size={size} />
      </span>
    );
  }

  // Fallback to rendering the raw name/text when no Lucide mapping exists.
  return (
    <span className="koda-icon" aria-hidden={title ? 'false' : 'true'} title={title}>
      {name}
    </span>
  );
}
