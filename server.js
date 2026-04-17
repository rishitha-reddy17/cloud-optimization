const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors());
 
// 🔐 Your credentials will come from frontend
app.post("/connect-azure", async (req, res) => {
    const { tenantId, clientId, clientSecret, subscriptionId } = req.body;

    try {
        // STEP 1: Get OAuth Token
        const tokenResponse = await axios.post(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret,
                scope: "https://management.azure.com/.default"
            }),
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // STEP 2: Fetch Actual Cost
        const costUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-03-01`;

        const payload = {
            type: "ActualCost",
            timeframe: "MonthToDate",
            dataset: {
                granularity: "None",
                aggregation: {
                    totalCost: {
                        name: "Cost",
                        function: "Sum"
                    }
                },
                grouping: [
                    { type: "Dimension", name: "ServiceName" }
                ]
            }
        };

        const actualCost = await axios.post(costUrl, payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        // STEP 3: Fetch Amortized Cost
        const amortPayload = { ...payload, type: "AmortizedCost" };

        const amortCost = await axios.post(costUrl, amortPayload, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        res.json({
            actual: actualCost.data,
            amortized: amortCost.data
        });

    } catch (error) {
        res.status(500).json({
            error: error.response?.data || error.message
        });
    }
});

app.listen(3000, () => console.log("Backend running on http:// localhost:3000"));
