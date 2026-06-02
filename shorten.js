exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { url } = body;
  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing url field" }) };
  }

  try {
    const api = "https://is.gd/create.php?format=json&url=" + encodeURIComponent(url);
    const res = await fetch(api);
    if (!res.ok) throw new Error("is.gd returned " + res.status);
    const data = await res.json();
    if (!data.shorturl) throw new Error("No shorturl in response");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ shorturl: data.shorturl })
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: err.message })
    };
  }
};
