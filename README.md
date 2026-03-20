
	async getExchangeReport(
		filters: any,
		options: any
	): Promise<IPage<IExchangeContent>> {
		try {
			const { currencyType, status, ...rawFilters } = filters;

			const pipeline: any[] = [
				{
					$match: {
						...rawFilters,
						status: TRANSACTION_STATUS.includes(
							filters.status as string
						)
							? filters.status
							: "COMPLETED",
					},
				},
				{
					$lookup: {
						from: "currencies",
						localField: "fromCurrency",
						foreignField: "_id",
						as: "fromCurrency",
						pipeline: [
							{
								$project: {
									code: 1,
									name_en: 1,
									name_kh: 1,
									symbol: 1,
								},
							},
						],
					},
				},
				{
					$unwind: {
						path: "$fromCurrency",
						preserveNullAndEmptyArrays: true,
					},
				},
				{
					$lookup: {
						from: "currencies",
						localField: "toCurrency",
						foreignField: "_id",
						as: "toCurrency",
						pipeline: [
							{
								$project: {
									code: 1,
									name_en: 1,
									name_kh: 1,
									symbol: 1,
								},
							},
						],
					},
				},
				{
					$unwind: {
						path: "$toCurrency",
						preserveNullAndEmptyArrays: true,
					},
				},
				{
					$lookup: {
						from: "users",
						let: { confirmedById: "$confirmedBy" },
						pipeline: [
							{
								$match: {
									$expr: { $eq: ["$_id", "$$confirmedById"] },
								},
							},
							{
								$project: {
									_id: 1,
									username: 1,
									name: 1,
									email: 1,
									role: 1,
								},
							},
						],
						as: "confirmedBy",
					},
				},
				{
					$unwind: {
						path: "$confirmedBy",
						preserveNullAndEmptyArrays: true,
					},
				},
				{
					$sort: {
						createdAt: -1,
					},
				},
				{
					$group: {
						_id: {
							exchangeDate: {
								$dateToString: {
									format: "%Y-%m-%d",
									date: { $toDate: "$createdAt" },
								},
							},
							currencyType: {
								$ifNull: [
									"$currencyType",
									{
										$concat: [
											"$fromCurrency.code",
											"/",
											"$toCurrency.code",
										],
									},
								],
							},
							rateUsed: {
								$convert: {
									input: "$rateUsed",
									to: "double",
									onError: 0,
									onNull: 0,
								},
							},
							status: "$status",
							bid: {
								$convert: {
									input: "$rateId.bid",
									to: "double",
									onError: 0,
									onNull: 0,
								},
							},
							ask: {
								$convert: {
									input: "$rateId.ask",
									to: "double",
									onError: 0,
									onNull: 0,
								},
							},
							midRate: {
								$convert: {
									input: "$rateId.midRate",
									to: "double",
									onError: 0,
									onNull: 0,
								},
							},
							exchangeType: "$exchangeType",
							fromCurrency: "$fromCurrency",
							toCurrency: "$toCurrency",
						},
						confirmedBy: { $first: "$confirmedBy" },
						totalTransactions: { $sum: 1 },
						totalBaseCurrency: {
							$sum: {
								$convert: {
									input: "$inputAmount",
									to: "double",
									onError: 0,
									onNull: 0,
								},
							},
						},
						totalQuoteCurrency: {
							$sum: {
								$convert: {
									input: "$receiveAmount",
									to: "double",
									onError: 0,
									onNull: 0,
								},
							},
						},
						avgRate: {
							$avg: {
								$convert: {
									input: "$rateUsed",
									to: "double",
									onError: 0,
									onNull: 0,
								},
							},
						},
					},
				},
				{
					$project: {
						_id: 0,
						exchangeDate: "$_id.exchangeDate",
						rateUsed: "$_id.rateUsed",
						exchangeType: "$_id.exchangeType",
						currencyType: "$_id.currencyType",
						fromCurrency: "$_id.fromCurrency",
						toCurrency: "$_id.toCurrency",
						status: "$_id.status",
						bid: "$_id.bid",
						ask: "$_id.ask",
						midRate: "$_id.midRate",
						confirmedBy: 1,
						totalTransactions: 1,
						totalBaseCurrency: 1,
						totalQuoteCurrency: 1,
						avgRate: 1,
					},
				},
				...(currencyType ? [{ $match: { currencyType } }] : []),
				{
					$sort: {
						exchangeDate: -1,
						currencyType: 1,
						exchangeType: 1,
					},
				},
			];

			const skip = (options.page - 1) * options.limit;

			const dataPipeline = [
				...pipeline,
				{ $skip: skip },
				{ $limit: options.limit },
			];

			const countPipeline = [...pipeline, { $count: "total" }];

			const allExchangeSummaryPipeline = [
				...pipeline,
				{
					$group: {
						_id: {
							fromCurrencyCode: "$fromCurrency.code",
							toCurrencyCode: "$toCurrency.code",
						},
						totalBaseCurrency: { $sum: "$totalBaseCurrency" },
						totalQuoteCurrency: { $sum: "$totalQuoteCurrency" },
					},
				},
				{
					$project: {
						_id: 0,
						fromCurrencyCode: "$_id.fromCurrencyCode",
						toCurrencyCode: "$_id.toCurrencyCode",
						totalBaseCurrency: 1,
						totalQuoteCurrency: 1,
					},
				},
			];

			const [transactions, countResult, allExchangeSummaryResult] =
				await Promise.all([
					this.model.aggregate(dataPipeline),
					this.model.aggregate(countPipeline),
					this.model.aggregate(allExchangeSummaryPipeline),
				]);

			const thisPageSummary = transactions.reduce((acc: any, t: any) => {
				const key = `${t.fromCurrency.code}/${t.toCurrency.code}`;
				if (!acc[key]) {
					acc[key] = {
						fromCurrencyCode: t.fromCurrency.code,
						toCurrencyCode: t.toCurrency.code,
						totalBaseCurrency: 0,
						totalQuoteCurrency: 0,
					};
				}
				acc[key].totalBaseCurrency += t.totalBaseCurrency || 0;
				acc[key].totalQuoteCurrency += t.totalQuoteCurrency || 0;
				return acc;
			}, {} as Record<string, any>);

			const thisPageSummaryArray = Object.values(
				thisPageSummary
			) as ISummaryByCurrency[];

			return {
				content: {
					transactions,
					summary: {
						thisPage: thisPageSummaryArray,
						allExchange: allExchangeSummaryResult,
					},
				},
				totalCount: countResult[0]?.total ?? 0,
				page: options.page,
				limit: options.limit,
			};
		} catch (error) {
			console.error("Error get exchange report: ", error);
			throw error;
		}
	}
