const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');

class Logger {
  info(message) {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message) {
    console.log(chalk.green('✔'), message);
  }

  warn(message) {
    console.log(chalk.yellow('⚠'), message);
  }

  error(message) {
    console.log(chalk.red('✖'), message);
  }

  title(message) {
    console.log(chalk.bold.cyan(`\n${message}`));
  }

  table(data, columns) {
    if (data.length === 0) {
      console.log(chalk.gray('  (无数据)'));
      return;
    }
    const headers = columns.map(c => chalk.bold(c.label));
    const rows = data.map(item =>
      columns.map(c => String(item[c.key] || ''))
    );

    rows.forEach(row => {
      console.log(row.join('  |  '));
    });
  }

  spinner(text) {
    return ora({ text: chalk.cyan(text), spinner: 'dots' }).start();
  }
}

module.exports = new Logger();
