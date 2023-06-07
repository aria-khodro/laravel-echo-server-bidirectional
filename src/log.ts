// import util from "util";

const util = require('util');

let colors = require('colors');

colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    info: 'cyan',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red',
    h1: 'grey',
    h2: 'yellow'
});

const line = '_'.repeat(process.stdout.columns)

export class Log {
    /**
     * Console log heading 1.
     *
     * @param  {string|object} message
     * @return {void}
     */
    static title(message: any): void {
        this.logWithTime(colors.bold(message));
    }

    /**
     * Console log heaing 2.
     *
     * @param  {string|object} message
     * @return {void}
     */
    static subtitle(message: any): void {
        this.logWithTime(colors.h2.bold(message));
    }

    /**
     * Console log info.
     *
     * @param  {string|object} message
     * @return {void}
     */
    static info(message: any): void {
        this.logWithTime(colors.info(message));
    }

    /**
     * Console log success.
     *
     * @param  {string|object} message
     * @return {void}
     */
    static success(message: any): void {
        this.logWithTime(colors.green('\u2714 '), message);
    }

    /**
     *
     *
     * Console log info.
     *
     * @param  {string|object} message
     * @return {void}
     */
    static error(message: any): void {
        this.logWithTime(colors.error(message));
    }

    /**
     * Console log warning.
     *
     * @param  {string|object} message
     * @return {void}
     */
    static warning(message: any): void {
        this.logWithTime(colors.warn('\u26A0 ' + message));
    }

    static debug(message: any): void {
        this.inspectLog(message);
    }

    static logWithTime(...message: any): void {
        console.log(colors.bgWhite.black(`[${new Date().toLocaleString()}] `), ...message)
    }

    static inspectLog(...message: any): void {
        console.debug(colors.bgWhite.black(`[${new Date().toLocaleString()}] `), util.inspect(...message, true, null, true))
        console.log(colors.data(line));
    }
}
