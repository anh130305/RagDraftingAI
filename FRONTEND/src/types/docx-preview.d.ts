declare module 'docx-preview' {
    export interface Options {
        className?: string;
        inWrapper?: boolean;
        ignoreWidth?: boolean;
        ignoreHeight?: boolean;
        ignoreFonts?: boolean;
        breakPages?: boolean;
        debug?: boolean;
        experimental?: boolean;
        useBase64URL?: boolean;
        useMathMLPolyfill?: boolean;
    }

    export function renderAsync(
        data: any,
        bodyContainer: HTMLElement,
        styleContainer?: HTMLElement,
        options?: Options
    ): Promise<any>;
}
