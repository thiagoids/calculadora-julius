const el = id => document.getElementById(id);

function numero(v) {
  return parseFloat(v.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
}

function moeda(v) {
  return v.toFixed(2).replace('.', ',');
}

function mascaraMoeda(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    v = (parseInt(v || 0) / 100).toFixed(2);
    input.value = 'R$ ' + v.replace('.', ',');
  });
}

function mascaraPercentual(input) {
  input.addEventListener('input', () => {
    let v = input.value
      .replace(/[^0-9,]/g, '')
      .replace(/(,.*),/g, '$1');
    input.value = v ? v + ' %' : '';
  });
}

function irRegressivo(dias) {
  if (dias <= 180) return 0.225;
  if (dias <= 360) return 0.20;
  if (dias <= 720) return 0.175;
  return 0.15;
}

function iofRegressivo(dias) {
  if (dias > 30) return 0;
  return (30 - dias) / 30;
}

function validar() {
  let ok = true;

  const valor = numero(el('valorCompra').value);
  const desconto = numero(el('desconto').value);
  const parcelas = parseInt(el('parcelas').value);
  const cdi = numero(el('cdi').value);

  const regras = [
    ['erroValor', valor > 0],
    ['erroDesconto', desconto >= 0 && desconto <= 100],
    ['erroParcelas', parcelas > 0],
    ['erroCdiReq', cdi > 0]
  ];

  regras.forEach(([erro, cond]) => {
    el(erro).style.display = cond ? 'none' : 'block';
    if (!cond) ok = false;
  });

  return ok;
}

function calcular() {
  if (!validar()) return;

  const valor = numero(el('valorCompra').value);
  const desconto = numero(el('desconto').value) / 100;
  const parcelas = parseInt(el('parcelas').value);
  const cdiAnual = numero(el('cdi').value) / 100;
  const percCdi = numero(el('percentualCdi').value) / 100;

  const valorVista = valor * (1 - desconto);
  const taxaDiaria = Math.pow(1 + cdiAnual * percCdi, 1 / 252) - 1;
  const parcela = valor / parcelas;
  const diasTotal = parcelas * 30;

  let saldo = valor;
  let rendimentoBruto = 0;
  let tabela = '';

  for (let m = 1; m <= parcelas; m++) {
    let rendimentoMes = 0;
    const saldoAntes = saldo;

    if (m > 1) {
      for (let d = 0; d < 30; d++) {
        const r = saldo * taxaDiaria;
        rendimentoMes += r;
        saldo += r;
      }
    }

    rendimentoBruto += rendimentoMes;
    saldo -= parcela;

    tabela += `
      <tr>
        <td>${m}</td>
        <td>R$ ${moeda(saldoAntes)}</td>
        <td>R$ ${moeda(rendimentoMes)}</td>
        <td>R$ ${moeda(parcela)}</td>
        <td>R$ ${moeda(saldo)}</td>
      </tr>`;
  }

  const iof = rendimentoBruto * iofRegressivo(diasTotal);
  const ir = (rendimentoBruto - iof) * irRegressivo(diasTotal);

  const rendimentoLiquido = rendimentoBruto - iof - ir;
  const saldoLiquido = saldo - iof - ir;
  const custoParcelado = valor - saldoLiquido;

  el('veredicto').innerHTML =
    `<strong>Resultado da simulação</strong><br><br>
     Primeiro mês sem rendimento. Aplicação rende a partir do segundo mês.
     IOF incide apenas até 30 dias. IR segue tabela regressiva.<br><br>
     <strong>Conclusão:</strong> ` +
    (custoParcelado < valorVista
      ? 'Parcelar tende a ser financeiramente mais vantajoso.'
      : 'Pagar à vista tende a ser financeiramente mais vantajoso.') +
    `<br><br>
     Valor à vista: R$ ${moeda(valorVista)}<br>
     Valor parcelado efetivo: R$ ${moeda(custoParcelado)}`;

  el('possibilidadeVista').innerHTML =
    `<strong>Pagamento à vista</strong><br>
     Desembolso total: R$ ${moeda(valorVista)}`;

  el('possibilidadeParcelado').innerHTML =
    `<strong>Pagamento parcelado com investimento</strong><br><br>
     <table>
       <tr>
         <th>Mês</th>
         <th>Saldo antes</th>
         <th>Rendimento</th>
         <th>Parcela</th>
         <th>Saldo após</th>
       </tr>
       ${tabela}
     </table>
     <br>
     Rendimento bruto: R$ ${moeda(rendimentoBruto)}<br>
     IOF: R$ ${moeda(iof)}<br>
     IR: R$ ${moeda(ir)}<br>
     <strong>Rendimento líquido: R$ ${moeda(rendimentoLiquido)}</strong><br>
     Saldo final líquido: R$ ${moeda(saldoLiquido)}`;
}

async function usarCdiAtual() {
  el('erroCdi').style.display = 'none';
  try {
    const url =
      'https://api.allorigins.win/raw?url=' +
      encodeURIComponent(
        'https://api.bcb.gov.br/dados/serie/bcdata.sgs/12/dados?formato=json'
      );

    const resp = await fetch(url);
    if (!resp.ok) throw new Error();

    const dados = await resp.json();
    const ultimos = dados.slice(-252);

    let acumulado = 1;
    ultimos.forEach(d => {
      const diaria = parseFloat(d.valor.replace(',', '.')) / 100;
      acumulado *= (1 + diaria);
    });

    const cdiAnual = (acumulado - 1) * 100;
    el('cdi').value = cdiAnual.toFixed(2).replace('.', ',') + ' %';
  } catch {
    el('erroCdi').style.display = 'block';
  }
}

function limpar() {
  document.querySelectorAll('input').forEach(i => i.value = '');
  document.querySelectorAll('.erro').forEach(e => e.style.display = 'none');
  el('veredicto').innerHTML = 'Preencha os campos e clique em calcular';
  el('possibilidadeVista').innerHTML = '';
  el('possibilidadeParcelado').innerHTML = '';
}

mascaraMoeda(el('valorCompra'));
mascaraPercentual(el('desconto'));
mascaraPercentual(el('percentualCdi'));
mascaraPercentual(el('cdi'));

el('btnCalcular').onclick = calcular;
el('btnLimpar').onclick = limpar;
el('btnCdi').onclick = usarCdiAtual;
