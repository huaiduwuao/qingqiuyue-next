import '@mui/material/styles';
import '@mui/x-data-grid/themeAugmentation';

declare module '@mui/material/styles' {
  interface TypeText {
    tertiary: string;
  }

  interface Palette {
    text: TypeText;
  }
}
