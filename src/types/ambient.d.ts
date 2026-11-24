// Whop Elements are configured with plain props documented at https://docs.whop.com/elements.
// src/lib/whop-elements.tsx reads the components by name and passes props through. These
// declarations type the two imports loosely, so the template keeps type-checking as Elements
// adds or renames options between releases.
declare module '@whop/elements';
declare module '@whop/elements-react';
