const georgia11Art = [
  "",
  "",
  "`7MM\"\"\"Mq.`7MM\"\"\"Mq.  `7MMF'`YMM'   `MM'   db      `7MN.   `7MF'.M\"\"\"bgd ",
  "  MM   `MM. MM   `MM.   MM    VMA   ,V    ;MM:       MMN.    M ,MI    \"Y ",
  "  MM   ,M9  MM   ,M9    MM     VMA ,V    ,V^MM.      M YMb   M `MMb.     ",
  "  MMmmdM9   MMmmdM9     MM      VMMP    ,M  `MM      M  `MN. M   `YMMNq. ",
  "  MM        MM  YM.     MM       MM     AbmmmqMA     M   `MM.M .     `MM ",
  "  MM        MM   `Mb.   MM       MM    A'     VML    M     YMM Mb     dM ",
  ".JMML.    .JMML. .JMM..JMML.   .JMML..AMA.   .AMMA..JML.    YM P\"Ybmmd\"  ",
  "",
  "",
  "",
  "",
  "`7MMF'  `7MMF'`7MMF'   `7MF'",
  "  MM      MM    MM       M  ",
  "  MM      MM    MM       M  ",
  "  MMmmmmmmMM    MM       M  ",
  "  MM      MM    MM       M  ",
  "  MM      MM    YM.     ,M  ",
  ".JMML.  .JMML.   `bmmmmd\"'  ",
  "",
  "",
  "",
  "",
  "`7MM\"\"\"Mq.        db        `7MMF'`7MM\"\"\"Mq.`7MMF'   `7MF'MMP\"\"MM\"\"YMM ",
  "  MM   `MM.      ;MM:         MM    MM   `MM. MM       M  P'   MM   `7 ",
  "  MM   ,M9      ,V^MM.        MM    MM   ,M9  MM       M       MM      ",
  "  MMmmdM9      ,M  `MM        MM    MMmmdM9   MM       M       MM      ",
  "  MM  YM.      AbmmmqMA       MM    MM        MM       M       MM      ",
  "  MM   `Mb.   A'     VML (O)  MM    MM        YM.     ,M       MM      ",
  ".JMML. .JMM..AMA.   .AMMA.Ymmm9   .JMML.       `bmmmmd\"'     .JMML.    ",
  "",
  "",
].join('\n')

const smallPriyanshuArt = [
  " ___     _                   _        ",
  "| _ \\_ _(_)_  _ __ _ _ _  __| |_ _  _ ",
  "|  _/ '_| | || / _` | ' \\(_-< ' \\ || |",
  "|_| |_| |_|\\_, \\__,_|_||_/__/_||_\\_,_|",
  "           |__/                       ",
].join('\n')

export function Header() {
  return (
    <section className="my-8">
      <div className="hidden md:block overflow-x-auto">
        <pre className="font-mono text-[0.65rem] leading-[1.05] text-content whitespace-pre m-0">{georgia11Art}</pre>
      </div>
      <div className="md:hidden overflow-x-auto">
        <pre className="font-mono text-[0.55rem] sm:text-[0.65rem] leading-[1.05] text-content whitespace-pre m-0">{smallPriyanshuArt}</pre>
      </div>
      <p className="text-content-muted"><i>Software engineer building infrastructure, platforms, and developer tooling</i></p>
    </section>
  )
}
