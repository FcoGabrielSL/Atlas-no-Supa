async function run() {
  const t = Date.now();
  const url = `https://script.google.com/macros/s/AKfycbxG9mOMXiO2mrtBZWh6Nk9skS8wFiLSIueXa5ldCweZxhgT2C1fDMR3qATs7DQxsIWr/exec?t=${t}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Keys in returned live data:", Object.keys(data));
    const dados = data.DADOS || data.Dados || data.dados || [];
    console.log(`DADOS sheet rows count: ${dados.length}`);
    if (dados.length > 0) {
      console.log("Sample DADOS item:", JSON.stringify(dados[0], null, 2));
      console.log("Keys of first DADOS item:", Object.keys(dados[0]));
    }
  } catch (err) {
    console.error(err);
  }
}
run();

