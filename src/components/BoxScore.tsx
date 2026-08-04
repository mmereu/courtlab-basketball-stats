import { formatMinutes, PlayerStats, pct } from "../domain";

type BoxScoreLine = Omit<PlayerStats, "player">;

const totalLine = (stats: PlayerStats[]): BoxScoreLine =>
  stats.reduce<BoxScoreLine>(
    (total, row) => ({
      pts: total.pts + row.pts,
      fgm: total.fgm + row.fgm,
      fga: total.fga + row.fga,
      twoPm: total.twoPm + row.twoPm,
      twoPa: total.twoPa + row.twoPa,
      threePm: total.threePm + row.threePm,
      threePa: total.threePa + row.threePa,
      ftm: total.ftm + row.ftm,
      fta: total.fta + row.fta,
      oreb: total.oreb + row.oreb,
      dreb: total.dreb + row.dreb,
      ast: total.ast + row.ast,
      stl: total.stl + row.stl,
      tov: total.tov + row.tov,
      blk: total.blk + row.blk,
      foul: total.foul + row.foul,
      foulDrawn: total.foulDrawn + row.foulDrawn,
      blockedAgainst: total.blockedAgainst + row.blockedAgainst,
      eff: total.eff + row.eff,
      pir: total.pir + row.pir,
      fastBreakPoints: total.fastBreakPoints + row.fastBreakPoints,
      secondsPlayed: (total.secondsPlayed ?? 0) + (row.secondsPlayed ?? 0),
      plusMinus: (total.plusMinus ?? 0) + (row.plusMinus ?? 0),
    }),
    {
      pts: 0, fgm: 0, fga: 0, twoPm: 0, twoPa: 0, threePm: 0, threePa: 0,
      ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, tov: 0, blk: 0,
      foul: 0, foulDrawn: 0, blockedAgainst: 0, eff: 0, pir: 0, fastBreakPoints: 0,
      secondsPlayed: 0, plusMinus: 0,
    },
  );

function StatCells({ row, fastBreakPointsAgainst = 0 }: { row: BoxScoreLine; fastBreakPointsAgainst?: number }) {
  return (
    <>
      <td className="accent-cell">{row.pts}</td>
      <td>{formatMinutes(row.secondsPlayed)}</td>
      <td className={(row.plusMinus ?? 0) > 0 ? "positive-cell" : (row.plusMinus ?? 0) < 0 ? "negative-cell" : ""}>
        {(row.plusMinus ?? 0) > 0 ? "+" : ""}{row.plusMinus ?? 0}
      </td>
      <td>{row.twoPm}/{row.twoPa}</td>
      <td>{pct(row.twoPm, row.twoPa)}</td>
      <td>{row.threePm}/{row.threePa}</td>
      <td>{pct(row.threePm, row.threePa)}</td>
      <td>{row.ftm}/{row.fta}</td>
      <td>{pct(row.ftm, row.fta)}</td>
      <td>{row.oreb + row.dreb}</td>
      <td>{row.dreb}</td>
      <td>{row.oreb}</td>
      <td>{row.tov}</td>
      <td>{row.stl}</td>
      <td>{row.ast}</td>
      <td>{row.blk}</td>
      <td>{row.blockedAgainst}</td>
      <td>{row.foulDrawn}</td>
      <td>{row.foul}</td>
      <td>{row.fastBreakPoints}</td>
      <td>{fastBreakPointsAgainst}</td>
      <td className="value-cell">{row.pir}</td>
    </>
  );
}

export default function BoxScore({
  stats, teamStats, teamPlusMinus, fastBreakPointsAgainst = 0,
}: {
  stats: PlayerStats[];
  teamStats?: Omit<PlayerStats, "player" | "secondsPlayed" | "plusMinus">;
  teamPlusMinus?: number;
  fastBreakPointsAgainst?: number;
}) {
  const playerTotals = totalLine(stats);
  const totals: BoxScoreLine = teamStats
    ? { ...teamStats, secondsPlayed: playerTotals.secondsPlayed, plusMinus: teamPlusMinus ?? 0 }
    : playerTotals;

  return (
    <div className="boxscore-wrap">
      <p className="boxscore-hint">Tabella completa · scorri orizzontalmente per vedere tutte le statistiche →</p>
      <div className="boxscore-scroll" role="region" aria-label="Box score completo" tabIndex={0}>
        <table className="boxscore boxscore-full">
        <thead>
          <tr>
            <th>Giocatore</th><th>PT</th><th>MIN</th><th>+/-</th><th>2P</th><th>2P%</th><th>3P</th><th>3P%</th>
            <th>TL</th><th>TL%</th><th>RT</th><th>RD</th><th>RO</th><th>PP</th>
            <th>PR</th><th>AS</th><th>STF</th><th>STS</th><th>FS</th><th>FC</th>
            <th>CPF</th><th>CPS</th><th>VAL</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr key={row.player.id}>
              <td><strong>#{row.player.number}</strong> {row.player.shortName}</td>
              <StatCells row={row} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td>TOTALE</td><StatCells row={totals} fastBreakPointsAgainst={fastBreakPointsAgainst} /></tr>
        </tfoot>
        </table>
      </div>
      <div className="four-factors">
        <div className="rebounds-total"><small>RIMBALZI TOTALI</small><strong>{totals.oreb + totals.dreb}</strong></div>
        <div><small>2P%</small><strong>{pct(totals.twoPm, totals.twoPa)}</strong></div>
        <div><small>3P%</small><strong>{pct(totals.threePm, totals.threePa)}</strong></div>
        <div><small>TL%</small><strong>{pct(totals.ftm, totals.fta)}</strong></div>
        <div><small>VAL</small><strong>{totals.pir}</strong></div>
      </div>
    </div>
  );
}
