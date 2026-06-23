const ascii = [
  "                      ,,                                         ,,                  ",
  "`7MM\"\"\"Mq.            db                                       `7MM                  ",
  "  MM   `MM.                                                      MM                  ",
  "  MM   ,M9 `7Mb,od8 `7MM `7M'   `MF',6\"Yb.  `7MMpMMMb.  ,pP\"Ybd  MMpMMMb.`7MM  `7MM  ",
  "  MMmmdM9    MM' \"'   MM   VA   ,V 8)   MM    MM    MM  8I   \"   MM    MM  MM    MM  ",
  "  MM         MM       MM    VA ,V   ,pm9MM    MM    MM  `YMMMa.  MM    MM  MM    MM  ",
  "  MM         MM       MM     VVV   8M   MM    MM    MM  L.   I8  MM    MM  MM    MM  ",
  ".JMML.     .JMML.   .JMML.   ,V    `Moo9'Yo..JMML  JMML.M9mmmP'.JMML  JMML.`Mbod\"YML.",
  "                            ,V                                                       ",
  "                         OOb\"                                                        ",
  "                                                                                     ",
  "                     ,,                                                              ",
  "`7MM\"\"\"Mq.           db                        mm                                    ",
  "  MM   `MM.                                    MM                                    ",
  "  MM   ,M9   ,6\"Yb.`7MM `7MMpdMAo.`7MM  `7MM mmMMmm                                  ",
  "  MMmmdM9   8)   MM  MM   MM   `Wb  MM    MM   MM                                    ",
  "  MM  YM.    ,pm9MM  MM   MM    M8  MM    MM   MM                                    ",
  "  MM   `Mb. 8M   MM  MM   MM   ,AP  MM    MM   MM                                    ",
  ".JMML. .JMM.`Moo9'Yo.MM   MMbmmd'   `Mbod\"YML. `Mbmo                                 ",
  "                  QO MP   MM                                                         ",
  "                  `bmP  .JMML.                                                        ",
].join('\n')

export function Header() {
  return (
    <section className="my-8">
      <div className=" overflow-x-auto">
        <pre className="font-mono sm:text-[0.85rem] text-[0.35rem] leading-[1.05] text-content whitespace-pre m-0">{ascii}</pre>
      </div>
      <p className="text-content-muted"><i>Software engineer building infrastructure, platforms, and developer tooling</i></p>
    </section>
  )
}
